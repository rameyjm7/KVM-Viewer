from flask import Flask, Response
import subprocess

app = Flask(__name__)

GST_PIPELINE = [
    "gst-launch-1.0", "-q",
    "v4l2src", "device=/dev/video0", "!",
      "video/x-raw,format=YUY2,width=640,height=480,framerate=30/1", "!",
    "videoconvert", "!",
    "jpegenc", "!",
    "multipartmux", "boundary=frame", "!",
    "fdsink", "fd=1"
]

def gst_mjpeg_stream():
    """
    Launch gst-launch-1.0 to grab from /dev/video0, JPEG-encode
    and multipart-mux, then yield raw bytes to the HTTP client.
    """
    # spawn GStreamer pipeline
    proc = subprocess.Popen(
        GST_PIPELINE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=0
    )

    try:
        # stream out whatever GStreamer writes
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
    """
    Serves an MJPEG stream at /video_feed.
    """
    return Response(
        gst_mjpeg_stream(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
