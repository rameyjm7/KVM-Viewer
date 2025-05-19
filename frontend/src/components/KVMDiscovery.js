import React, { useState } from 'react';
import axios from 'axios';
import { Button, MenuItem, Select, FormControl, InputLabel } from '@mui/material';

export default function KVMDiscovery() {
  const [kvms, setKvms] = useState([]);
  const [selected, setSelected] = useState('');

  const discoverKvms = () => {
    const discoverKVM = `http://${serverHost}:5000/discover_kvm`;
    axios.get(discoverKVM).then(res => setKvms(res.data));
  };

  return (
    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
      <Button variant="contained" onClick={discoverKvms} style={{ backgroundColor: '#007AFF', color: 'white' }}>
        Discover KVMs
      </Button>
      <FormControl style={{ marginLeft: '15px', minWidth: '150px' }}>
        <InputLabel style={{ color: 'white' }}>Select KVM</InputLabel>
        <Select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ color: 'white' }}>
          {kvms.map((kvm) => (<MenuItem key={kvm} value={kvm}>{kvm}</MenuItem>))}
        </Select>
      </FormControl>
    </div>
  );
}
