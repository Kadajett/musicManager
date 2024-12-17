import React, { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { invoke } from '@tauri-apps/api/core';
import { AudioMetadata } from '../types/music';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaList } from 'react-icons/fa';

export function PlayerFooter() {
  const {
    currentTrack,
    isPlaying,
    volume,
    progress,
    duration,
    position,
    playTrack,
    pauseTrack,
    resumeTrack,
    setVolume,
    seekTo,
    nextTrack,
    previousTrack,
    queue,
  } = usePlayer();

  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [showQueue, setShowQueue] = useState(false);

  console.log(duration);

  useEffect(() => {
    if (currentTrack) {
      invoke<AudioMetadata>('get_audio_metadata', { path: currentTrack.path })
        .then(setMetadata)
        .catch(console.error);
    } else {
      setMetadata(null);
    }
  }, [currentTrack]);

  useEffect(() => {
    let intervalId: number;

    if (isPlaying) {
      intervalId = window.setInterval(async () => {
        try {
          const position = await invoke<number>('get_track_position');
          setCurrentPosition(position);
        } catch (err) {
          console.error('Error getting track position:', err);
        }
      }, 1000); // Update every second
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    // Consider the track finished if it's within 0.1 seconds of the end
    const TRACK_END_THRESHOLD = 0.1;
    if (duration > 0 && (duration - currentPosition) <= TRACK_END_THRESHOLD) {
      nextTrack();
      resumeTrack();
    }
  }, [currentPosition, duration, nextTrack, resumeTrack]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formattedPosition = formatTime(currentPosition);

  // Calculate progress percentage from currentPosition
  const progressPercentage = duration > 0 ? (currentPosition / duration) * 100 : 0;

  if (!currentTrack) {
    return (
      <div className="h-[200px] flex items-center justify-center text-gray-500 dark:text-gray-400">
        No track selected
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Player section - fixed height */}
      <div className="flex-none bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="flex p-4 space-x-4">
          {/* Album art - smaller size */}
          <div className="w-[100px] h-[100px] rounded-lg bg-gray-200 dark:bg-gray-800 overflow-hidden flex-shrink-0">
            {metadata?.album_art ? (
              <img
                src={`data:image/jpeg;base64,${metadata.album_art}`}
                alt="Album art"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400 dark:text-gray-600">
                🎵
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium text-gray-900 dark:text-white truncate">
              {metadata?.title || currentTrack.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {metadata?.artist || 'Unknown Artist'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 truncate">
              {metadata?.album || 'Unknown Album'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={previousTrack}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <FaStepBackward className="w-4 h-4" />
            </button>
            <button
              onClick={isPlaying ? pauseTrack : resumeTrack}
              className="p-3 text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {isPlaying ?
                <FaPause className="w-5 h-5" /> :
                <FaPlay className="w-5 h-5" />
              }
            </button>
            <button
              onClick={nextTrack}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <FaStepForward className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full flex items-center space-x-2 mb-4">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10">
              {formattedPosition}
            </span>
            <div className="relative flex-1 h-1 group">
              <div className="absolute w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={duration}
                value={currentPosition}
                onChange={(e) => {
                  const newPosition = parseFloat(e.target.value);
                  setCurrentPosition(newPosition);
                  seekTo(newPosition);
                }}
                className="absolute w-full h-1 opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume */}
          <div className="flex items-center space-x-2 px-2">
            <FaVolumeUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <div className="relative flex-1 h-1 group">
              <div className="absolute w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="absolute w-full h-1 opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Queue section - scrollable */}
      <div className="flex-1 overflow-y-auto">
        {queue.map((track) => (
          <div
            key={track.path}
            className={`px-6 py-3 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer
              ${currentTrack?.path === track.path ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
            onClick={() => playTrack(track, queue)}
          >
            <div className="w-8 h-8 flex-shrink-0 rounded bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
              {currentTrack?.path === track.path && isPlaying ? (
                <FaPause className="w-3 h-3 text-blue-500 dark:text-blue-400" />
              ) : (
                <FaPlay className="w-3 h-3 text-gray-400 dark:text-gray-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {track.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 