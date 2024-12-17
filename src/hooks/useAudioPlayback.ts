import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../types/music';
import path from 'path-browserify';

interface UseAudioPlaybackProps {
  playTrack: (file: FileItem, playlist: FileItem[]) => void;
}

export function useAudioPlayback({ playTrack }: UseAudioPlaybackProps) {
  const handleFilePlay = useCallback((
    file: FileItem,
    files: FileItem[],
  ) => {
    if (!file.is_audio) return;

    // Get all audio files from the same directory
    const dirPath = path.dirname(file.path);
    const dirFiles = files.filter(f => 
      path.dirname(f.path) === dirPath && f.is_audio
    ).sort((a, b) => a.name.localeCompare(b.name));

    // Find the index of the clicked file in the directory's audio files
    const fileIndex = dirFiles.findIndex(f => f.path === file.path);
    
    // Set the entire directory as the playlist, starting from the clicked file
    const playlist = [
      ...dirFiles.slice(fileIndex),  // Files from clicked to end
      ...dirFiles.slice(0, fileIndex) // Files from start to clicked
    ];

    // Play the clicked file and set the rest as the playlist
    playTrack(file, playlist);
  }, [playTrack]);

  const handleFolderPlay = useCallback(async (folderPath: string) => {
    try {
      const audioFiles = await invoke<FileItem[]>('get_recursive_audio_files', { 
        path: folderPath 
      });
      
      if (audioFiles.length > 0) {
        // Sort the files by path to maintain folder structure
        const sortedFiles = audioFiles.sort((a, b) => a.path.localeCompare(b.path));
        playTrack(sortedFiles[0], sortedFiles);
      }
    } catch (err) {
      console.error('Error playing folder:', err);
    }
  }, [playTrack]);

  return {
    handleFilePlay,
    handleFolderPlay
  };
} 