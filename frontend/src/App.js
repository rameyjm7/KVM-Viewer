import React, { useState } from 'react';
import './App.css';
import VideoFeed from './components/VideoFeed';
import VirtualKeyboard from './components/VirtualKeyboard';
import { Box, IconButton } from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';

function App() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  return (
    <Box sx={{ bgcolor:'#000', m:0, p:0, width:'100vw', height:'100vh', position:'relative' }}>
      <VideoFeed />

      {/* always mounted, just hide UI inside */}
      <Box
        sx={{
          position:'absolute', bottom:0, left:0,
          width:'100%', bgcolor: keyboardVisible ? 'rgba(0,0,0,0.6)' : 'transparent',
          pointerEvents: keyboardVisible ? 'auto' : 'none',
          zIndex: 999
        }}
      >
        <VirtualKeyboard visible={keyboardVisible} />
      </Box>

      <IconButton
        onClick={() => setKeyboardVisible(v => !v)}
        sx={{ position:'absolute', bottom:16, left:16, bgcolor:'#222', color:'white', zIndex:1000 }}
      >
        <KeyboardIcon />
      </IconButton>
    </Box>
  );
}

export default App;
