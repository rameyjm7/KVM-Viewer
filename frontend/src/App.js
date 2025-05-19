import React from 'react';
import VideoFeed from './components/VideoFeed';
import VirtualKeyboard from './components/VirtualKeyboard';
import { Container, Typography, Box } from '@mui/material';

function App() {
  return (
    <Container style={{ backgroundColor: '#121212', minHeight: '100vh', color: 'white', paddingTop: '20px' }}>
      <Typography variant="h5" align="center">Pi-KVM Remote Interface</Typography>
      <Box sx={{ my: 2 }}>
        <VideoFeed />
        <VirtualKeyboard />
      </Box>
    </Container>
  );
}

export default App;
