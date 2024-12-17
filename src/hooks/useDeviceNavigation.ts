import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../types/music';
import { SortOption } from '../types/fileBrowser';
import { Device } from '../types/device';

export function useDeviceNavigation() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [relativePath, setRelativePath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadDeviceDirectory = useCallback(async (devicePath: string, relPath: string | null, sortBy: SortOption) => {
    console.log('loadDeviceDirectory', devicePath, relPath, sortBy);
    setIsLoading(true);
    setError('');
    
    try {
      const items = await invoke<FileItem[]>('read_device_dir', { 
        devicePath,
        relativePath: relPath 
      });
      console.log('loaded items', items);
      setFiles(items);
    } catch (err) {
      setError(err as string);
      console.error('Error loading device directory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);


  const selectDevice = useCallback((device: Device | null) => {
    console.log('selectDevice', device);
    setSelectedDevice(device);
    if (device) {
      console.log('selected Device', device);
      setCurrentPath(device.path);
      setRelativePath('');
      setHistory([]);
      loadDeviceDirectory(device.path, null, 'fileName');
      console.log('loaded device directory', device.path);
    } else {
      // Clear state when deselecting
      console.log('deselecting');
      setCurrentPath('');
      setRelativePath('');
      setHistory([]);
      setFiles([]);
    }
  }, [loadDeviceDirectory]);

  const navigateToDirectory = useCallback((path: string, sortBy: SortOption) => {
    if (!selectedDevice) return;

    // Calculate the relative path from the device root
    const newRelativePath = path.replace(selectedDevice.path, '').replace(/^\//, '');
    
    setCurrentPath(path);
    setRelativePath(newRelativePath);
    setHistory(prev => [...prev, currentPath]);
    loadDeviceDirectory(selectedDevice.path, newRelativePath || null, sortBy);
  }, [selectedDevice, currentPath, loadDeviceDirectory]);

  const handleBack = useCallback(() => {
    if (!selectedDevice || history.length === 0) return null;

    const previousPath = history[history.length - 1];
    const newRelativePath = previousPath.replace(selectedDevice.path, '').replace(/^\//, '');

    setHistory(prev => prev.slice(0, -1));
    setCurrentPath(previousPath);
    setRelativePath(newRelativePath);
    loadDeviceDirectory(selectedDevice.path, newRelativePath || null, 'fileName');

    return previousPath;
  }, [selectedDevice, history, loadDeviceDirectory]);

  return {
    selectedDevice,
    currentPath,
    relativePath,
    files,
    history,
    isLoading,
    error,
    selectDevice,
    navigateToDirectory,
    handleBack
  };
} 