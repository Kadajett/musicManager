import React from 'react';
import { FaMicrophone, FaList, FaFolderPlus, FaStar, FaRegStar, FaUpload } from 'react-icons/fa';
import { ViewMode, SortOption } from '../types/fileBrowser';
import { useDevice } from '../context/DeviceContext';
import { useFileNavigationContext } from '../context/FileNavigationContext';
import { useTransferProgress } from '../hooks/useTransferProgress';
import { Modal } from './Modal';

interface FileBrowserToolbarProps {
  sortBy: SortOption;
  viewMode: ViewMode;
  isDefault: boolean;
  hasSelectedItems: boolean;
  onSortChange: (option: SortOption) => void;
  onViewModeToggle?: () => void;
  onCreateFolder?: () => void;
  onSetDefault?: () => void;
}

export function FileBrowserToolbar({
  sortBy,
  viewMode,
  isDefault,
  hasSelectedItems,
  onSortChange,
  onViewModeToggle,
  onCreateFolder,
  onSetDefault
}: FileBrowserToolbarProps) {
    const { selectedDevice, transferFileOrDirectory, currentPath: devicePath, relativePath: deviceRelativePath } = useDevice();
    const {currentPath: localPath} = useFileNavigationContext();
    const { transferProgress, isTransferring } = useTransferProgress();
  return (
    <>
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="fileName">Sort by Name</option>
              <option value="title">Sort by Title</option>
              <option value="trackNumber">Sort by Track #</option>
            </select>
            {onViewModeToggle && (
              <button
                onClick={onViewModeToggle}
                className={`
                  p-2 rounded-lg transition-colors duration-150
                  ${viewMode === 'artists'
                    ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }
                `}
                title={viewMode === 'artists' ? 'Switch to file view' : 'Switch to artist view'}
              >
                {viewMode === 'artists' ? <FaMicrophone /> : <FaList />}
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {hasSelectedItems && (
              <button
                onClick={onCreateFolder}
                className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 
                  dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                title="Combine selected folders"
              >
                <FaFolderPlus />
              </button>
            )}
            {onSetDefault && (
              <button
                onClick={onSetDefault}
                className={`
                  px-3 py-1 text-sm rounded-md transition-colors duration-150 flex items-center
                  ${isDefault 
                    ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
                  }
                `}
                title={isDefault ? 'Default location' : 'Set as default location'}
              >
                {isDefault ? <FaStar className="mr-1" /> : <FaRegStar className="mr-1" />}
                {isDefault ? 'Default' : 'Set as Default'}
              </button>
            )}
            {selectedDevice && devicePath && (
              <button
                onClick={() => transferFileOrDirectory(localPath, devicePath)}
                className={`p-2 rounded-lg ${
                  isTransferring 
                    ? 'bg-gray-200 cursor-not-allowed' 
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                } dark:bg-blue-900/30 dark:text-blue-400`}
                disabled={isTransferring}
                title={isTransferring ? 'Transfer in progress' : 'Transfer to device'}
              >
                <FaUpload />
              </button>
            )}
          </div>
        </div>
      </div>

      {isTransferring && transferProgress && (
        <Modal>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Transfer in Progress</h3>
            <p className="mb-2">{transferProgress.status}</p>
            {transferProgress.current_file && (
              <p className="text-sm text-gray-600 mb-2">
                Current file: {transferProgress.current_file}
              </p>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ 
                  width: `${(transferProgress.processed_files / transferProgress.total_files) * 100}%`
                }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {transferProgress.processed_files} of {transferProgress.total_files} files
            </p>
          </div>
        </Modal>
      )}
    </>
  );
} 