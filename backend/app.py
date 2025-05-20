from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import subprocess
import logging
import os
import re
import errno

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

# ----------------------------------------
# 1) Video feed configuration & streaming
# ----------------------------------------
def get_supported_resolutions(device='/dev/video0'):
    out = subprocess.check_output(
        ['v4l2-ctl', '--list-formats-ext', f'--device={device}']
    )
    txt = out.decode('utf-8', errors='ignore')
    sizes = re.findall(r'Size:\s*Discrete\s*(\d+)x(\d+)', txt)
    return [(int(w), int(h)) for w, h in sizes]

# pick the largest resolution available
res = get_supported_resolutions('/dev/video0')
FEED_WIDTH, FEED_HEIGHT = max(res, key=lambda r: r[0] * r[1])
GST_PIPELINE = [
    "gst-launch-1.0", "-q",
    "v4l2src", f"device=/dev/video0", "!",
    f"video/x-raw,format=YUY2,width={FEED_WIDTH},height={FEED_HEIGHT},framerate=30/1", "!",
    "videoconvert", "!",
    "jpegenc", "!",
    "multipartmux", "boundary=frame", "!",
    "fdsink", "fd=1"
]
print(f"Using {FEED_WIDTH}×{FEED_HEIGHT} for video feed")

def gst_mjpeg_stream():
    proc = subprocess.Popen(
        GST_PIPELINE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=0
    )
    try:
        while True:
            chunk = proc.stdout.read(4096)
            if not chunk:
                break
            yield chunk
    finally:
        proc.stdout.close()
        proc.terminate()
        proc.wait()

@app.route('/video_feed')
def video_feed():
    return Response(
        gst_mjpeg_stream(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

# ----------------------------------
# 2) Keyboard HID (writes to hidg0)
# ----------------------------------
# ----------------------------------
# 2) Keyboard HID (writes to hidg0)
# ----------------------------------
@app.route('/keypress', methods=['POST'])
def keypress():
    data    = request.get_json(force=True) or {}
    keyName = data.get('key', '')
    action  = data.get('action', '')   # "down" or "up"
    ctrl    = bool(data.get('ctrl', False))
    shift   = bool(data.get('shift', False))

    app.logger.info(f"{action.upper():6} Key={keyName!r} (ctrl={ctrl}, shift={shift})")

    # Named keys
    KEY_MAP = {
        'backspace': 0x2A, 'tab': 0x2B, 'enter': 0x28,
        'escape':    0x29, 'space': 0x2C, 'capslock': 0x39,
    }
    # Punctuation and symbols
    PUNCT_MAP = {
        '`':0x35, '-':0x2D, '=':0x2E,
        '[':0x2F, ']':0x30, '\\':0x31,
        ';':0x33, "'":0x34, ',':0x36,
        '.':0x37, '/':0x38
    }

    # Determine HID usage code
    if len(keyName) == 1:
        ch = keyName
        if ch.isalpha():
            code = ord(ch.lower()) - ord('a') + 0x04
        elif ch.isdigit():
            code = 0x27 if ch == '0' else 0x1E + (int(ch) - 1)
        else:
            code = PUNCT_MAP.get(ch, 0x00)
    else:
        code = KEY_MAP.get(keyName.lower(), 0x00)

    # Modifiers: bit0=Ctrl, bit1=Shift
    mod = (0x01 if ctrl else 0x00) | (0x02 if shift else 0x00)

    # Build press/release reports
    press_report   = bytes([mod, 0x00, code, 0, 0, 0, 0, 0])
    release_report = bytes([0x00] * 8)

    hid0 = '/dev/hidg0'
    if not os.path.exists(hid0):
        app.logger.warning(f"HID0 {hid0!r} missing, skipping")
        return jsonify(status="ok", skipped=True)

    try:
        with open(hid0, 'wb') as fd:
            if action == 'down':
                fd.write(press_report)
            else:
                fd.write(release_report)
            fd.flush()
    except Exception as e:
        app.logger.error(f"HID write error: {e}")
        return jsonify(status="error", error=str(e)), 500

    return jsonify(status="ok", key=keyName, action=action)


# --------------------------------------------------
# 3) Mouse HID with persistent FD and ESHUTDOWN retry
# --------------------------------------------------
MOUSE_DEV = '/dev/hidg1'
_mouse_fd  = None

def _open_mouse():
    global _mouse_fd
    if _mouse_fd is None:
        try:
            _mouse_fd = os.open(MOUSE_DEV, os.O_WRONLY | os.O_NONBLOCK)
        except OSError as e:
            app.logger.error(f"Cannot open {MOUSE_DEV}: {e}")
            _mouse_fd = None
    return _mouse_fd

def write_mouse(report: bytes):
    global _mouse_fd
    fd = _open_mouse()
    if fd is None:
        raise IOError("Mouse device unavailable")
    try:
        os.write(fd, report)
    except OSError as e:
        if e.errno == errno.ESHUTDOWN:
            app.logger.warning("Mouse ESHUTDOWN, reopening...")
            try: os.close(fd)
            except: pass
            _mouse_fd = None
            fd = _open_mouse()
            if fd is None:
                raise IOError("Mouse unavailable after reopen")
            os.write(fd, report)
        else:
            raise

# track last relative coords for scaled movement
last_rel = {'x': None, 'y': None}

@app.route('/mouse_move', methods=['POST'])
def mouse_move():
    """
    Handles both relative motion and absolute teleport.
    Send JSON with:
      - x (0..1), y (0..1)
      - init: true   -> teleport from 0,0 once (old behavior)
      - absolute: true -> teleport from 0,0 every time
      - omit flags for scaled relative motion
    """
    global last_rel
    data     = request.get_json(force=True) or {}
    rx       = float(data.get('x', 0.0))
    ry       = float(data.get('y', 0.0))
    init     = bool(data.get('init', False))
    absolute = bool(data.get('absolute', False))

    # compute target in guest pixels
    tx = int(rx * FEED_WIDTH)
    ty = int(ry * FEED_HEIGHT)

    if absolute:
        # teleport from (0,0)
        dx, dy = tx, ty
    elif init or last_rel['x'] is None:
        # initial teleport once
        dx, dy = tx, ty
    else:
        # scaled relative movement
        dx = int((rx - last_rel['x']) * FEED_WIDTH)
        dy = int((ry - last_rel['y']) * FEED_HEIGHT)

    # clamp to HID’s ±127
    dx = max(-127, min(127, dx))
    dy = max(-127, min(127, dy))

    # update origin
    last_rel['x'], last_rel['y'] = rx, ry

    report = bytes([0x00, dx & 0xFF, dy & 0xFF, 0x00])
    try:
        write_mouse(report)
    except Exception as e:
        app.logger.error(f"Mouse move error: {e}")
        return jsonify(status="error", error=str(e)), 500

    return jsonify(status="ok")

@app.route('/mouse_down', methods=['POST'])
def mouse_down():
    btn    = int(request.json.get('button', 0))
    mask   = {0:0x01, 2:0x02, 1:0x04}.get(btn, 0x00)
    report = bytes([mask, 0, 0, 0])
    try:
        write_mouse(report)
    except Exception as e:
        app.logger.error(f"Mouse down error: {e}")
        return jsonify(status="error", error=str(e)), 500
    return jsonify(status="ok")

@app.route('/mouse_up', methods=['POST'])
def mouse_up():
    report = bytes([0x00, 0, 0, 0])
    try:
        write_mouse(report)
    except Exception as e:
        app.logger.error(f"Mouse up error: {e}")
        return jsonify(status="error", error=str(e)), 500
    return jsonify(status="ok")

# -------------------
# 4) Run Flask server
# -------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
