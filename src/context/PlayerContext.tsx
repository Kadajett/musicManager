import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem, AudioMetadata } from '../types/music';

interface PlayerContextType {
  currentTrack: FileItem | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  position: number;
  duration: number;
  queue: FileItem[];
  playTrack: (track: FileItem, playlist?: FileItem[]) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  seekTo: (position: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  addToQueue: (track: FileItem) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [history, setHistory] = useState<FileItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const playTrack = useCallback(async (track: FileItem, playlist?: FileItem[]) => {
    try {
      // Get metadata first to get duration
      const metadata = await invoke<AudioMetadata>('get_audio_metadata', { path: track.path });
      if (metadata.duration) {
        setDuration(metadata.duration);
      }

      await invoke('play_audio', { path: track.path });
      
      // Add current track to history if it exists and we're not navigating through history
      if (currentTrack && historyIndex === -1) {
        setHistory(prev => [...prev, currentTrack]);
      } else if (historyIndex >= 0) {
        // If we're in history, truncate the history to current position before adding
        setHistory(prev => [...prev.slice(0, historyIndex + 1), currentTrack!]);
      }
      
      setCurrentTrack(track);
      setIsPlaying(true);
      setHistoryIndex(-1); // Reset history index when playing a new track
      
      setProgress(0);

      // If a playlist is provided, set it as the queue (excluding the current track)
      if (playlist) {
        const newQueue = playlist.filter(item => item.path !== track.path);
        setQueue(newQueue);
      } else {
        // If no playlist is provided, clear the queue
        setQueue([]);
      }
    } catch (err) {
      console.error('Failed to play track:', err);
    }
  }, [currentTrack, historyIndex]);

  const pauseTrack = useCallback(async () => {
    try {
      await invoke('pause_audio');
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to pause track:', err);
    }
  }, []);

  const resumeTrack = useCallback(async () => {
    try {
      await invoke('resume_audio');
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to resume track:', err);
    }
  }, []);

  const setVolume = useCallback(async (newVolume: number) => {
    try {
      await invoke('set_volume', { volume: newVolume });
      setVolumeState(newVolume);
    } catch (err) {
      console.error('Failed to set volume:', err);
    }
  }, []);

  const seekTo = useCallback(async (newPosition: number) => {
    try {
      await invoke('seek_to', { position: newPosition });
      setProgress((newPosition / duration) * 100);
    } catch (err) {
      console.error('Failed to seek to position:', err);
    }
  }, [duration]);

  const nextTrack = useCallback(async () => {
    if (queue.length > 0) {
      const nextTrack = queue[0];
      const remainingQueue = queue.slice(1);
      await playTrack(nextTrack);
      setQueue(remainingQueue);
    }
  }, [queue, playTrack]);

  const previousTrack = useCallback(async () => {
    if (position > 5) {
      // If we're more than 5 seconds into the track, just restart it
      seekTo(0);
    } else if (history.length > 0) {
      // If we have history, go back one track
      const newIndex = historyIndex === -1 ? history.length - 1 : historyIndex - 1;
      if (newIndex >= 0) {
        const prevTrack = history[newIndex];
        setHistoryIndex(newIndex);
        await playTrack(prevTrack);
      }
    }
  }, [history, historyIndex, position, seekTo, playTrack]);

  const addToQueue = useCallback((track: FileItem) => {
    setQueue(prev => [...prev, track]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Clean up function to reset history when unmounting
  useEffect(() => {
    return () => {
      setHistory([]);
      setHistoryIndex(-1);
      invoke('stop_audio').catch(console.error);
    };
  }, []);

  // useeffect to update progress
  useEffect(() => {
    const interval = setInterval(async () => {
      const position = await invoke<number>('get_track_position');
      console.log('Position:', position, 'Duration:', duration);
      // Convert position to progress percentage if duration is available
      if (duration > 0) {
        setProgress((position / duration) * 100);
        setPosition(position);
      } else {
        setProgress(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [duration]);

  const value = {
    currentTrack,
    isPlaying,
    volume,
    progress,
    position,
    duration,
    queue,
    playTrack,
    pauseTrack,
    resumeTrack,
    setVolume,
    setProgress,
    seekTo,
    nextTrack,
    previousTrack,
    addToQueue,
    clearQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
} 