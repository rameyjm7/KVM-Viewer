from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import subprocess
import logging
import os
import re
import errno
import threading
import time

def start_frontend():
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    npm_cmd = ['npm', 'start']
    try:
        process = subprocess.Popen(
            npm_cmd,
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=1,
            universal_newlines=True
        )
        for line in process.stdout:
            logging.info(f"[Frontend] {line.strip()}")
    except Exception as e:
        logging.error(f"Failed to start frontend: {e}")

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
            _mouse_fd = os.open(MOUSE_DEV, os.O_WRONLY)
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

# -----------------------------------------------------------------
# Mouse motion  – now honours current position for absolute jumps
# -----------------------------------------------------------------
# -----------------------------------------------------------------
# Mouse motion — perfect alignment, even from unknown start position
# -----------------------------------------------------------------
last_px = {'x': None, 'y': None}          # where we *believe* the guest cursor is

@app.route('/mouse_move', methods=['POST'])
def mouse_move():
    """
    Three use-cases
      1) { px, py, absolute_px:true }     ← jump to *exact* pixel on entry
      2) { x,  y }                        ← scaled relative (fractions 0-1)
      3) { x,  y, init:true }             ← legacy origin sync
    """
    global last_px
    data       = request.get_json(force=True) or {}

    # ---------- absolute pixel teleport (entry / leave) ----------
    if data.get('absolute_px'):
        tx = int(data['px'])
        ty = int(data['py'])
        # If we have no idea where the guest pointer is, move to corner first
        if last_px['x'] is None:
            _chunk_move(-127 * 100, -127 * 100)   # fling to 0,0 safely
            last_px['x'], last_px['y'] = 0, 0

        _chunk_move(tx - last_px['x'], ty - last_px['y'])
        last_px['x'], last_px['y'] = tx, ty
        return jsonify(status="ok")

    # ---------- one-time origin sync (legacy) ----------
    if data.get('init'):
        tx = int(float(data['x']) * FEED_WIDTH)
        ty = int(float(data['y']) * FEED_HEIGHT)
        last_px['x'], last_px['y'] = tx, ty
        return jsonify(status="ok", init=True)

    # ---------- normal relative motion ----------
    rx = float(data.get('x', 0.0))
    ry = float(data.get('y', 0.0))
    tx = int(rx * FEED_WIDTH)
    ty = int(ry * FEED_HEIGHT)

    if last_px['x'] is None:
        last_px['x'], last_px['y'] = tx, ty        # first call: just park tracker
        return jsonify(status="ok")

    _chunk_move(tx - last_px['x'], ty - last_px['y'])
    last_px['x'], last_px['y'] = tx, ty
    return jsonify(status="ok")


# --------------------------------------------------
# Helper: emit as many HID packets as needed
# --------------------------------------------------
def _chunk_move(dx, dy):
    """Send relative motion, splitting into ±127 hops so nothing is clipped."""
    while abs(dx) > 127 or abs(dy) > 127:
        step_x = max(-127, min(127, dx))
        step_y = max(-127, min(127, dy))
        _hid_move(step_x, step_y)
        dx -= step_x
        dy -= step_y
    _hid_move(dx, dy)

def _hid_move(dx, dy):
    write_mouse(bytes([0x00, dx & 0xFF, dy & 0xFF, 0x00]))

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

# ----------------------------
# 4) Mouse wheel / scroll HID
# ----------------------------
@app.route('/mouse_wheel', methods=['POST'])
def mouse_wheel():
    """
    Receives JSON { wheel: int } where wheel is -127..127.
    Positive = scroll down, Negative = scroll up (USB HID convention).
    """
    data = request.get_json(force=True) or {}
    w = int(data.get('wheel', 0))
    # clamp to signed byte range
    w = max(-127, min(127, w))

    # build HID report: [buttons=0, dx=0, dy=0, wheel]
    report = bytes([0x00, 0x00, 0x00, w & 0xFF])
    try:
        write_mouse(report)
    except Exception as e:
        app.logger.error(f"Mouse wheel error: {e}")
        return jsonify(status="error", error=str(e)), 500

    return jsonify(status="ok", wheel=w)

# -------------------
# 4) Run Flask server
# -------------------
if __name__ == '__main__':
    threading.Thread(target=start_frontend, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, threaded=True)
