import React, { useRef } from 'react';
import axios from 'axios';

export default function VideoFeed() {
  const imgRef = useRef();
  const server = `http://${window.location.hostname}:5000`;

  // Fire once when your cursor enters the image
  const handleMouseEnter = e => {
    const img  = imgRef.current;
    const rect = img.getBoundingClientRect();
    const x    = (e.clientX - rect.left) / rect.width;
    const y    = (e.clientY - rect.top)  / rect.height;

    axios.post(`${server}/mouse_move`, { x, y, init: true })
         .catch(console.error);
  };

  // Every move after that
  const handleMouseMove = e => {
    const img  = imgRef.current;
    const rect = img.getBoundingClientRect();
    const x    = (e.clientX - rect.left) / rect.width;
    const y    = (e.clientY - rect.top)  / rect.height;

    axios.post(`${server}/mouse_move`, { x, y })
         .catch(console.error);
  };

  const handleMouseDown = e =>
    axios.post(`${server}/mouse_down`, { button: e.button })
         .catch(console.error);

  const handleMouseUp = e =>
    axios.post(`${server}/mouse_up`, { button: e.button })
         .catch(console.error);

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
          cursor:      'crosshair'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
