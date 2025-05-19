from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import subprocess
import logging
import os

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

# ——————————————————————————————————————————————
# 1) gst-launch MJPEG→HTTP pipeline
# ——————————————————————————————————————————————
GST_PIPELINE = [
    "gst-launch-1.0","-q",
    "v4l2src","device=/dev/video0","!",
      "video/x-raw,format=YUY2,width=640,height=480,framerate=30/1","!",
    "videoconvert","!",
    "jpegenc","!",
    "multipartmux","boundary=frame","!",
    "fdsink","fd=1"
]

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
    key    = data.get('key', '')
    action = data.get('action', '')   # "down" or "up"
    ctrl   = bool(data.get('ctrl', False))
    shift  = bool(data.get('shift',False))
    caps   = bool(data.get('caps', False))

    app.logger.info(
        f"{action.upper():6} Key={key!r}  "
        f"(ctrl={ctrl}, shift={shift}, caps={caps})"
    )

    if action == 'down' and ctrl and key.upper() == 'C':
        app.logger.info("👉 Ctrl+C detected!")

    hid_path = '/dev/hidg0'
    if os.path.exists(hid_path):
        try:
            with open(hid_path, 'rb+') as fd:
                if action == 'down':
                    write_press(fd, key, ctrl, shift, caps)
                elif action == 'up':
                    write_release(fd, key, ctrl, shift, caps)
        except Exception as e:
            app.logger.error(f"HID write error: {e}")
            return jsonify(status="error", error=str(e)), 500
    else:
        app.logger.warning(f"HID device {hid_path!r} not found; skipping write")

    return jsonify(status="ok", key=key, action=action)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
