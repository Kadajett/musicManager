import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface Device {
  name: string;
  path: string;
  deviceType: string;
  removable: boolean;
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    // Get initial devices
    invoke<Device[]>('get_connected_devices')
      .then(setDevices)
      .catch(console.error);

    // Start watching for device changes
    invoke('watch_devices')
      .catch(console.error);

    // Listen for device changes
    const listenForDevices = async () => {
      const unlisten = await listen<Device[]>('devices-changed', (event) => {
        setDevices(event.payload);
      });
      return unlisten;
    };

    const unsubscribe = listenForDevices();

    // Cleanup
    return () => {
      unsubscribe.then(unlisten => unlisten());
    };
  }, []);

  return devices;
} 