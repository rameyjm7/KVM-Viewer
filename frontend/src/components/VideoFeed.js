import React from 'react';

export default function VideoFeed() {
  const serverHost = window.location.hostname;
  const videoUrl = `http://${serverHost}:5000/video_feed`;
  return (
    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
      <img
        src={videoUrl}
        alt="Video Feed"
        style={{ width: '640px', borderRadius: '10px', border: '3px solid #007AFF' }}
      />
    </div>
  );
}
