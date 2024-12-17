import React, { useCallback, useEffect } from 'react';
import { FileItem } from '../types/music';
import { usePlayer } from '../context/PlayerContext';
import { useFileNavigationContext } from '../context/FileNavigationContext';
import { useFileSelection } from '../hooks/useFileSelection';
import { useArtistMode } from '../hooks/useArtistMode';
import { useFolderOperations } from '../hooks/useFolderOperations';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { FileBrowserHeader } from './FileBrowserHeader';
import { FileBrowserToolbar } from './FileBrowserToolbar';
import { FileList } from './FileList';
import { invoke } from '@tauri-apps/api/core';

export function FileBrowser() {
  const { playTrack } = usePlayer();
  
  const {
    currentPath,
    files,
    history,
    isLoading,
    error,
    isDefault,
    navigateToDirectory,
    handleBack,
    setAsDefault,
    setHistory
  } = useFileNavigationContext();

  console.log('files', files);

  const {
    selectedItems,
    handleItemSelect,
    handleCheckboxChange,
    clearSelection,
    updateFilesRef
  } = useFileSelection();

  const {
    viewMode,
    artists,
    handleViewModeToggle
  } = useArtistMode();

  const {
    isCreatingFolder,
    newFolderName,
    setIsCreatingFolder,
    setNewFolderName,
    handleCombineFolders,
    cancelFolderCreation
  } = useFolderOperations();

  const {
    handleFilePlay,
    handleFolderPlay
  } = useAudioPlayback({ playTrack });

  // Update filesRef when files change
  useEffect(() => {
    updateFilesRef(files);
  }, [files, updateFilesRef]);

  const handleFileClick = useCallback((file: FileItem, index: number, event: React.MouseEvent) => {
    if (Object.keys(selectedItems).length > 0) {
      handleItemSelect(file, index, event);
      return;
    }

    if (file.is_dir) {
      setHistory(prev => [...prev, currentPath]);
      navigateToDirectory(file.path, 'fileName');
    } else if (file.is_audio) {
      handleFilePlay(file, files);
    }
  }, [
    selectedItems, 
    handleItemSelect, 
    setHistory, 
    currentPath, 
    navigateToDirectory, 
    files,
    handleFilePlay
  ]);

  const handleCombineFoldersSuccess = useCallback(() => {
    clearSelection();
    navigateToDirectory(currentPath, 'fileName');
  }, [clearSelection, navigateToDirectory, currentPath]);

  const handleMoveFile = useCallback(async (sourceId: string, targetId: string) => {
    console.log('handleMoveFile', sourceId, targetId);
    try {
      const sourceFile = files.find(f => f.path === sourceId);
      const targetFile = files.find(f => f.path === targetId);

      if (!sourceFile || !targetFile) return;

      // Don't allow moving a folder into itself or its children
      if (sourceFile.is_dir && targetFile.path.startsWith(sourceFile.path)) {
        console.log('Cannot move a folder into itself or its children');
        return;
      }

      if (!sourceFile.is_dir && !targetFile.is_dir) {
        // Create a new folder with both files
        const newFolderName = 'New Folder';
        await invoke('combine_files', {
          sourcePath: sourceId,
          targetPath: targetId,
          newFolderName,
          parentPath: currentPath
        });
      } else if (targetFile.is_dir) {
        // Move file or folder into target folder
        await invoke('move_file', {
          sourcePath: sourceId,
          targetPath: targetId
        });
      }

      // Refresh the current directory
      navigateToDirectory(currentPath, 'fileName');
    } catch (err) {
      console.error('Error moving file:', err);
    }
  }, [files, currentPath, navigateToDirectory]);

  const handleRefresh = useCallback(() => {
    navigateToDirectory(currentPath, 'fileName');
  }, [currentPath, navigateToDirectory]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <FileBrowserHeader
        currentPath={currentPath}
        onBack={handleBack}
        onNavigate={(path) => navigateToDirectory(path, 'fileName')}
      />

      <FileBrowserToolbar
        sortBy="fileName"
        viewMode={viewMode}
        isDefault={isDefault}
        hasSelectedItems={Object.keys(selectedItems).length > 0}
        onSortChange={(option) => navigateToDirectory(currentPath, option)}
        onViewModeToggle={() => handleViewModeToggle(currentPath)}
        onCreateFolder={() => setIsCreatingFolder(true)}
        onSetDefault={() => setAsDefault(currentPath)}
      />

      {isCreatingFolder && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter new folder name"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <button
              onClick={() => handleCombineFolders(selectedItems, currentPath, handleCombineFoldersSuccess)}
              className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600
                dark:bg-green-600 dark:hover:bg-green-700"
            >
              Create
            </button>
            <button
              onClick={cancelFolderCreation}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
                dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <FileList
          files={files}
          artists={artists}
          viewMode={viewMode}
          selectedItems={selectedItems}
          isLoading={isLoading}
          error={error}
          onFileClick={handleFileClick}
          onCheckboxChange={handleCheckboxChange}
          onPlayFolder={handleFolderPlay}
          onMoveFile={handleMoveFile}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
} 