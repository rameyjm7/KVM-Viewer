from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import subprocess
import logging
import os
import re

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)


def get_supported_resolutions(device='/dev/video0'):
    """Query v4l2-ctl for supported resolutions and return a list of (width, height) tuples."""
    output = subprocess.check_output(['v4l2-ctl', '--list-formats-ext', f'--device={device}'])
    text = output.decode('utf-8', errors='ignore')
    # Regex to find lines like "Size: Discrete 1920x1080"
    sizes = re.findall(r'Size:\s*Discrete\s*(\d+)x(\d+)', text)
    return [(int(w), int(h)) for w, h in sizes]

# Get all supported resolutions
resolutions = get_supported_resolutions('/dev/video0')

# Select the largest resolution by area (width * height)
width, height = max(resolutions, key=lambda res: res[0] * res[1])

# Build the GStreamer pipeline dynamically
GST_PIPELINE = [
    "gst-launch-1.0", "-q",
    "v4l2src", f"device=/dev/video0", "!",
    f"video/x-raw,format=YUY2,width={width},height={height},framerate=30/1", "!",
    "videoconvert", "!",
    "jpegenc", "!",
    "multipartmux", "boundary=frame", "!",
    "fdsink", "fd=1"
]

# For demonstration, print the chosen resolution and pipeline
print(f"Selected resolution: {width}x{height}")
print("GST_PIPELINE =", GST_PIPELINE)

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

# ——————————————————————————————————————————————
# 2) Keyboard endpoint with press/release + HID check
# ——————————————————————————————————————————————
def write_press(fd, key, ctrl, shift, caps):
    # TODO: replace with your actual HID report format
    # e.g. fd.write(bytes([modifier_byte, 0x00, keycode,0,0,0,0,0]))
    pass

def write_release(fd, key, ctrl, shift, caps):
    # TODO: your key‐release HID report
    # e.g. fd.write(bytes(8))
    pass

@app.route('/keypress', methods=['POST'])
def keypress():
    data   = request.get_json(force=True) or {}
    keyName = data.get('key', '')
    action  = data.get('action', '')   # "down" or "up"
    ctrl    = bool(data.get('ctrl', False))
    shift   = bool(data.get('shift', False))

    app.logger.info(f"{action.upper():6} Key={keyName!r} (ctrl={ctrl}, shift={shift})")

    # HID usages for common keys:
    KEY_MAP = {
        'backspace': 0x2A,
        'tab':       0x2B,
        'enter':     0x28,
        'escape':    0x29,
        'space':     0x2C,
        'capslock':  0x39,
        # add more here if you need: f1–f12, arrows, punctuation…
    }

    # letters a–z → 0x04–0x1D
    if len(keyName) == 1 and keyName.isalpha():
        code = ord(keyName.lower()) - ord('a') + 0x04
    # digits 1–9,0 → 0x1E–0x27
    elif len(keyName) == 1 and keyName.isdigit():
        digit = keyName
        # HID '1' is 0x1E, '2' is 0x1F, … '0' is 0x27
        code = 0x1E + (int(digit) - 1) if digit != '0' else 0x27
    else:
        code = KEY_MAP.get(keyName.lower(), 0x00)

    # Build modifier byte: bit0 = Left Ctrl, bit1 = Left Shift
    mod = (0x01 if ctrl else 0x00) | (0x02 if shift else 0x00)

    # Construct HID reports
    # [mod, reserved, keycode, 0, 0, 0, 0, 0]
    press_report   = bytes([mod, 0x00, code, 0, 0, 0, 0, 0])
    release_report = bytes([0x00]*8)

    hid_path = '/dev/hidg0'
    if not os.path.exists(hid_path):
        app.logger.warning(f"HID device {hid_path!r} not found; skipping write")
        return jsonify(status="ok", skipped=True)

    try:
        with open(hid_path, 'wb') as fd:
            if action == 'down':
                fd.write(press_report)
                fd.flush()
            elif action == 'up':
                fd.write(release_report)
                fd.flush()
    except Exception as e:
        app.logger.error(f"HID write error: {e}")
        return jsonify(status="error", error=str(e)), 500

    return jsonify(status="ok", key=keyName, action=action)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
