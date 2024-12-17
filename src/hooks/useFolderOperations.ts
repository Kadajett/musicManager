import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SelectedItems } from '../types/fileBrowser';

export function useFolderOperations() {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCombineFolders = useCallback(async (
    selectedItems: SelectedItems,
    currentPath: string,
    onSuccess: () => void
  ) => {
    if (!newFolderName.trim()) return;

    try {
      const selectedPaths = Object.values(selectedItems).map(item => item.path);
      await invoke('combine_folders', {
        paths: selectedPaths,
        newFolderName: newFolderName.trim(),
        parentPath: currentPath
      });

      // Reset state and trigger success callback
      setIsCreatingFolder(false);
      setNewFolderName('');
      onSuccess();
    } catch (err) {
      console.error('Error combining folders:', err);
    }
  }, [newFolderName]);

  const cancelFolderCreation = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  }, []);

  return {
    isCreatingFolder,
    newFolderName,
    setIsCreatingFolder,
    setNewFolderName,
    handleCombineFolders,
    cancelFolderCreation
  };
} 