import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../types/music';
import { SortOption } from '../types/fileBrowser';

export function useFileNavigation() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  const sortFiles = useCallback(async (files: FileItem[], sortOption: SortOption, dirPath: string) => {
    const directories = files.filter(f => f.is_dir);
    const audioFiles = files.filter(f => !f.is_dir);
    const sortedDirectories = directories.sort((a, b) => a.name.localeCompare(b.name));

    let sortedAudioFiles = audioFiles;
    if (sortOption === 'fileName') {
      sortedAudioFiles = [...audioFiles].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const metadata = await invoke<any[]>('get_metadata_for_directory', {
        path: dirPath,
        sortBy: sortOption === 'title' ? 'Title' : 'TrackNumber'
      });

      const metadataMap = new Map(metadata.map(m => [m.path, m]));

      sortedAudioFiles = [...audioFiles].sort((a, b) => {
        const metaA = metadataMap.get(a.path);
        const metaB = metadataMap.get(b.path);

        if (sortOption === 'title') {
          return (metaA?.title || a.name).localeCompare(metaB?.title || b.name);
        } else {
          const trackA = metaA?.track_number || Number.MAX_SAFE_INTEGER;
          const trackB = metaB?.track_number || Number.MAX_SAFE_INTEGER;
          return trackA - trackB;
        }
      });
    }

    return [...sortedDirectories, ...sortedAudioFiles];
  }, []);

  const loadDirectory = useCallback(async (path: string, sortBy: SortOption) => {
    setIsLoading(true);
    setError('');
    
    try {
      const items = await invoke<FileItem[]>('read_dir', { path });
      const sorted = await sortFiles(items, sortBy, path);
      setFiles(sorted);

      invoke<string[]>('add_recent_location', { path })
        .then(setRecentLocations)
        .catch(console.error);
    } catch (err) {
      setError(err as string);
      console.error('Error loading directory:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sortFiles]);

  const navigateToDirectory = useCallback((path: string, sortBy: SortOption) => {
    setCurrentPath(path);
    loadDirectory(path, sortBy);
  }, [loadDirectory]);

  const handleBack = useCallback(() => {
    if (history.length > 0) {
      const previousPath = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      return previousPath;
    }
    return null;
  }, [history]);

  const setAsDefault = useCallback(async (path: string) => {
    try {
      await invoke('set_default_location', { path });
      setIsDefault(true);
    } catch (err) {
      setError(err as string);
      console.error('Error setting default location:', err);
    }
  }, []);

  // Initialize default location
  useEffect(() => {
    const initializeDirectory = async () => {
      try {
        const defaultLocation = await invoke<string | null>('get_default_location');
        if (defaultLocation && currentPath === '') {
          navigateToDirectory(defaultLocation, 'fileName');
        } else if (currentPath === '') {
          const homePath = await invoke<string>('home_dir');
          setCurrentPath(homePath);
          loadDirectory(homePath, 'fileName');
        }
      } catch (err) {
        setError(err as string);
      }
    };

    initializeDirectory();
  }, []);

  // Check default status
  useEffect(() => {
    if (currentPath) {
      invoke<string | null>('get_default_location')
        .then(defaultLocation => {
          setIsDefault(defaultLocation === currentPath);
        })
        .catch(console.error);
    }
  }, [currentPath]);

  return {
    currentPath,
    files,
    history,
    isLoading,
    error,
    recentLocations,
    isDefault,
    navigateToDirectory,
    handleBack,
    setAsDefault,
    setHistory
  };
} 