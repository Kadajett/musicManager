import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArtistInfo, ViewMode } from '../types/fileBrowser';

export function useArtistMode() {
  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [artists, setArtists] = useState<ArtistInfo[]>([]);

  const handleViewModeToggle = useCallback(async (currentPath: string) => {
    const newMode = viewMode === 'files' ? 'artists' : 'files';
    setViewMode(newMode);
    
    if (newMode === 'artists' && currentPath) {
      try {
        const artistList = await invoke<ArtistInfo[]>('get_artists_in_directory', { 
          path: currentPath 
        });
        setArtists(artistList.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error('Error loading artists:', error);
      }
    }
  }, [viewMode]);

  return {
    viewMode,
    artists,
    handleViewModeToggle
  };
} 