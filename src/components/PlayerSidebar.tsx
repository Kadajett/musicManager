import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { FaPlay, FaPause } from 'react-icons/fa';
import { PlayerFooter } from './PlayerFooter';

export function PlayerSidebar() {
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

  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Queue</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">{queue.length} tracks</span>
      </div>
      <div className="overflow-y-auto h-full">
        {queue.map((track, index) => (
          <div
            key={track.path}
            className={`px-6 py-3 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer
              ${currentTrack?.path === track.path ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
            onClick={() => playTrack(track)}
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
      <PlayerFooter />
    </div>
  );
} 