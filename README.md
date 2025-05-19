# KVM-Viewer

KVM-Viewer is a web-based remote interface for Pi-KVM setups. It provides:

- **frontend/**: A React application for displaying a live MJPEG video stream and virtual keyboard
- **backend/**: A Flask server that streams video via GStreamer and handles keyboard input via USB HID gadget

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [License](#license)

## Prerequisites

### General

- Node.js (v14+)
- Python 3.8+
- Git

### Raspberry Pi (backend)

- GStreamer (`gst-launch-1.0`)
- Linux USB HID gadget configured (e.g., `/dev/hidg0`)
- Flask and dependencies

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rameyjm7/KVM-Viewer.git
   cd KVM-Viewer
   ```

2. **Backend setup**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Frontend setup**
   ```bash
   cd ../frontend
   npm install
   ```

## Usage

### Run Backend

```bash
cd backend
source venv/bin/activate
FLASK_APP=app.py flask run --host 0.0.0.0 --port 5000
```

### Run Frontend

```bash
cd frontend
npm start
```

Open your browser to `http://<pi-ip>:3000` to view the interface.

## Project Structure

```
KVM-Viewer/
├── backend/            # Flask server for video & keyboard
│   ├── app.py          # Main Flask application
│   ├── requirements.txt
│   └── ...
├── frontend/           # React client application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
└── README.md           # Project overview and setup instructions
```

## Configuration

- **Backend**: Adjust device paths (`/dev/video0`, `/dev/hidg0`) in `app.py` if your hardware differs.
- **Frontend**: The video and keypress API URLs point to the current host; no additional config needed.

## License

MIT License. See [LICENSE](LICENSE).
