import React, { createContext, useContext, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../types/music';
import { SortOption } from '../types/fileBrowser';
import { Device } from '../types/device';

interface DeviceContextType {
  selectedDevice: Device | null;
  currentPath: string;
  relativePath: string;
  files: FileItem[];
  history: string[];
  isLoading: boolean;
  error: string;
  selectDevice: (device: Device | null) => Promise<void>;
  navigateToDirectory: (path: string, sortBy: SortOption) => Promise<void>;
  handleBack: () => Promise<string | null>;
  transferFileOrDirectory: (localPath: string, devicePath: string) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [relativePath, setRelativePath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadDeviceDirectory = useCallback(async (devicePath: string, relPath: string | null, sortBy: SortOption) => {
    console.log('loadDeviceDirectory', { devicePath, relPath, sortBy });
    setIsLoading(true);
    setError('');
    
    try {
      const items = await invoke<FileItem[]>('read_device_dir', { 
        devicePath,
        relativePath: relPath 
      });
      console.log('loaded items', items);
      setFiles(items || []);
    } catch (err) {
      setError(err as string);
      console.error('Error loading device directory:', err);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const transferFileOrDirectory = useCallback(async (localPath: string, devicePath: string) => {
    console.log('transferFileOrDirectory', { localPath, devicePath });
    await invoke('transfer_files', { options: { source_path: localPath, target_path: devicePath, create_archive: true, verify_transfer: true } });
    await loadDeviceDirectory(currentPath, relativePath, 'fileName');
  }, [currentPath, relativePath, loadDeviceDirectory]);


  const selectDevice = useCallback(async (device: Device | null) => {
    console.log('selectDevice', device);
    
    setFiles([]);
    setHistory([]);
    setError('');
    
    if (device) {
      setSelectedDevice(device);
      setCurrentPath(device.path);
      setRelativePath('');
      
      await loadDeviceDirectory(device.path, null, 'fileName');
    } else {
      setSelectedDevice(null);
      setCurrentPath('');
      setRelativePath('');
    }
  }, [loadDeviceDirectory]);

  const navigateToDirectory = useCallback(async (path: string, sortBy: SortOption) => {
    if (!selectedDevice) return;

    const newRelativePath = path.replace(selectedDevice.path, '').replace(/^\//, '');
    
    setCurrentPath(path);
    setRelativePath(newRelativePath);
    setHistory(prev => [...prev, currentPath]);
    
    await loadDeviceDirectory(selectedDevice.path, newRelativePath || null, sortBy);
  }, [selectedDevice, currentPath, loadDeviceDirectory]);

  const handleBack = useCallback(async () => {
    if (!selectedDevice || history.length === 0) return null;

    const previousPath = history[history.length - 1];
    const newRelativePath = previousPath.replace(selectedDevice.path, '').replace(/^\//, '');

    setHistory(prev => prev.slice(0, -1));
    setCurrentPath(previousPath);
    setRelativePath(newRelativePath);
    
    await loadDeviceDirectory(selectedDevice.path, newRelativePath || null, 'fileName');

    return previousPath;
  }, [selectedDevice, history, loadDeviceDirectory]);

  const value = {
    selectedDevice,
    currentPath,
    relativePath,
    files,
    history,
    isLoading,
    error,
    selectDevice,
    navigateToDirectory,
    handleBack,
    transferFileOrDirectory
  };

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
} 