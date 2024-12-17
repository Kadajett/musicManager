import React, { useCallback } from 'react';
import { FileList } from './FileList';
import { FileBrowserHeader } from './FileBrowserHeader';
import { FileBrowserToolbar } from './FileBrowserToolbar';
import { useFileSelection } from '../hooks/useFileSelection';
import { FileItem } from '../types/music';
import { invoke } from '@tauri-apps/api/core';
import { useDevice } from '../context/DeviceContext';
import { ViewMode } from '../types/fileBrowser';

interface DeviceBrowserProps {
  onTransferComplete?: () => void;
}

export function DeviceBrowser({ onTransferComplete }: DeviceBrowserProps) {
  const {
    selectedDevice,
    currentPath,
    files,
    history,
    isLoading,
    error,
    navigateToDirectory,
    handleBack,
  } = useDevice();

  const {
    selectedItems,
    handleItemSelect,
    handleCheckboxChange,
    clearSelection,
    updateFilesRef
  } = useFileSelection();

  console.log('DeviceBrowser', selectedDevice, currentPath, files, history, isLoading, error);
  // Update filesRef when files change
  React.useEffect(() => {
    updateFilesRef(files);
  }, [files, updateFilesRef]);

  const handleFileClick = useCallback((file: FileItem, index: number, event: React.MouseEvent) => {
    if (Object.keys(selectedItems).length > 0) {
      handleItemSelect(file, index, event);
      return;
    }

    if (file.is_dir) {
      navigateToDirectory(file.path, 'fileName');
    }
  }, [selectedItems, handleItemSelect, navigateToDirectory]);

  const handleMoveFile = useCallback(async (sourcePath: string, targetPath: string) => {
    if (!selectedDevice) return;

    try {
      const options = {
        source_path: sourcePath,
        target_path: targetPath,
        create_archive: true,
        verify_transfer: true,
      };

      const result = await invoke('transfer_files', { options });
      console.log('Transfer result:', result);
      
      // Refresh the current directory after transfer
      navigateToDirectory(currentPath, 'fileName');
      onTransferComplete?.();
    } catch (err) {
      console.error('Error transferring files:', err);
    }
  }, [selectedDevice, currentPath, navigateToDirectory, onTransferComplete]);

  const handleRefresh = useCallback(() => {
    navigateToDirectory(currentPath, 'fileName');
  }, [currentPath, navigateToDirectory]);

  if (!selectedDevice) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        Select a device to browse its contents
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <FileBrowserHeader
        currentPath={currentPath}
        onBack={handleBack}
        onNavigate={(path) => navigateToDirectory(path, 'fileName')}
      />

      <FileBrowserToolbar
        sortBy="fileName"
        viewMode={'list' as ViewMode}
        isDefault={false}
        hasSelectedItems={Object.keys(selectedItems).length > 0}
        onSortChange={(option) => navigateToDirectory(currentPath, option)}
        onViewModeToggle={() => {}}
        onCreateFolder={() => {}}
        onSetDefault={() => {}}
      />

      <div className="flex-1 overflow-hidden">
        <FileList
          files={files}
          artists={[]}
          viewMode={'list' as ViewMode}
          selectedItems={selectedItems}
          isLoading={isLoading}
          error={error}
          onFileClick={handleFileClick}
          onCheckboxChange={handleCheckboxChange}
          onPlayFolder={() => {}} // No-op for device browser
          onMoveFile={handleMoveFile}
          onRefresh={handleRefresh}
          isDeviceBrowser={true}
        />
      </div>
    </div>
  );
} 