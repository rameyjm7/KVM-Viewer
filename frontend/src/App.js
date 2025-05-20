// App.js
import React from 'react';
import './App.css';           // ← add this line
import VideoFeed from './components/VideoFeed';
import VirtualKeyboard from './components/VirtualKeyboard';
import { Container, Typography, Box } from '@mui/material';

function App() {
  return (
    <Container
      maxWidth={false}          // remove MUI’s max-width cap
      disableGutters            // remove side padding so we truly hit the window edges
      sx={{ bgcolor: '#121212', minWidth: '100vw', minHeight: '100vh', color: 'white', pt: 2 }}
    >
      {/* Video takes the full width; keyboard sits below it */}
      <Box sx={{ width: '100%' }}>
        <VideoFeed />            {/* make sure the video element inside uses width: 100% */}
      </Box>

      <VirtualKeyboard />
    </Container>
  );
}

export default App;
