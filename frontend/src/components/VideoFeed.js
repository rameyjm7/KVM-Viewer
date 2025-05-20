// VideoFeed.js

import React, { useRef, useState } from 'react';
import axios from 'axios';

export default function VideoFeed() {
  const imgRef    = useRef();
  const server    = `http://${window.location.hostname}:5000`;
  const [hidden, setHidden] = useState(false);

  // Teleport the gadget cursor *exactly* to wherever you entered
  const handleMouseEnter = e => {
    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top)  / height;

    setHidden(true);
    axios
      .post(`${server}/mouse_move`, { x, y, absolute: true })
      .catch(console.error);
  };

  // Show your normal cursor again
  const handleMouseLeave = () => {
    setHidden(false);
  };

  // All subsequent moves are pure relative (scaled under the hood)
  const handleMouseMove = e => {
    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top)  / height;

    axios
      .post(`${server}/mouse_move`, { x, y })
      .catch(console.error);
  };

  // Clicks map straight through
  const handleMouseDown = e =>
    axios.post(`${server}/mouse_down`, { button: e.button }).catch(console.error);

  const handleMouseUp = e =>
    axios.post(`${server}/mouse_up`,   { button: e.button }).catch(console.error);

  return (
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <img
        ref={imgRef}
        src={`${server}/video_feed`}
        alt="Video Feed"
        style={{
          width:       '75vw',
          borderRadius: 10,
          border:      '3px solid #007AFF',
          cursor:      hidden ? 'none' : 'crosshair',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
