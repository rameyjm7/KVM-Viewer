// VideoFeed.js
import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';

export default function VideoFeed() {
  const imgRef = useRef();
  const server = `http://${window.location.hostname}:5000`;

  const [hidden, setHidden] = useState(false);
  const [ready,  setReady]  = useState(false);   // becomes true after first frame

  /* ------------------------------------------------------------------
   * Convert page coords →   { x (0-1), y (0-1), px, py } inside content
   * ------------------------------------------------------------------ */
  const getPos = e => {
    const img  = imgRef.current;
    const box  = img.getBoundingClientRect();
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    if (!natW || !natH) return { x: 0, y: 0, px: 0, py: 0 };

    const scale = Math.min(box.width / natW, box.height / natH);
    const dispW = natW * scale;
    const dispH = natH * scale;
    const offX  = (box.width  - dispW) / 2;
    const offY  = (box.height - dispH) / 2;

    let rx = (e.clientX - box.left - offX) / dispW;
    let ry = (e.clientY - box.top  - offY) / dispH;
    rx = Math.max(0, Math.min(1, rx));
    ry = Math.max(0, Math.min(1, ry));

    return {
      x : rx,
      y : ry,
      px: Math.round(rx * natW),
      py: Math.round(ry * natH)
    };
  };

  /* ------------------------ mouse handlers ------------------------- */
  const handleMouseEnter = e => {
    if (!ready) return;
    const { px, py } = getPos(e);
    setHidden(true);
    axios.post(`${server}/mouse_move`, { px, py, absolute_px: true }).catch(console.error);
  };

  const handleMouseLeave = () => setHidden(false);

  const handleMouseMove = e => {
    if (!ready) return;
    const { x, y } = getPos(e);
    axios.post(`${server}/mouse_move`, { x, y }).catch(console.error);
  };

  const handleWheel = e => {
    e.preventDefault();
    const w = -Math.sign(e.deltaY) * Math.min(127, Math.abs(e.deltaY));
    axios.post(`${server}/mouse_wheel`, { wheel: w }).catch(console.error);
  };

  const handleMouseDown = e =>
    axios.post(`${server}/mouse_down`, { button: e.button }).catch(console.error);

  const handleMouseUp = e =>
    axios.post(`${server}/mouse_up`, { button: e.button }).catch(console.error);

  // suppress Chrome context-menu but still allow our right-click packet
  const stopContextMenu = e => e.preventDefault();

  /* flag ready once first JPEG frame has size */
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) setReady(true);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'black',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      <img
        ref={imgRef}
        src={`${server}/video_feed`}
        alt="Video Feed"
        style={{
          maxWidth:  '100vw',
          maxHeight: '100vh',
          objectFit: 'contain',
          cursor: hidden ? 'none' : 'crosshair',
          userSelect: 'none'
        }}
        onLoad={() => setReady(true)}
        onContextMenu={stopContextMenu}  /* stop browser pop-up */
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
