import { useState, useCallback, useRef } from 'react';
import { FileItem } from '../types/music';
import { SelectedItems } from '../types/fileBrowser';

export function useFileSelection() {
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({});
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const filesRef = useRef<FileItem[]>([]);

  const updateFilesRef = useCallback((files: FileItem[]) => {
    filesRef.current = files;
  }, []);

  const handleItemSelect = useCallback((file: FileItem, index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setSelectedItems(prev => {
      const newSelection = { ...prev };
      
      if (event.shiftKey && lastSelectedIndex !== null) {
        // Keep existing selection when using shift+click
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        for (let i = start; i <= end; i++) {
          const item = filesRef.current[i];
          newSelection[item.path] = item;
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Toggle selection for Ctrl/Cmd+click
        if (newSelection[file.path]) {
          delete newSelection[file.path];
        } else {
          newSelection[file.path] = file;
        }
      } else if (event.type === 'change') { // Checkbox click
        // Toggle single item for checkbox clicks
        if (newSelection[file.path]) {
          delete newSelection[file.path];
        } else {
          newSelection[file.path] = file;
        }
      } else {
        // Clear selection and select only this item for regular clicks
        Object.keys(newSelection).forEach(key => delete newSelection[key]);
        newSelection[file.path] = file;
      }
      
      return newSelection;
    });
    
    setLastSelectedIndex(index);
  }, [lastSelectedIndex]);

  const handleCheckboxChange = useCallback((file: FileItem, index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    handleItemSelect(file, index, {
      ...event,
      stopPropagation: () => event.stopPropagation(),
      type: 'change'
    } as unknown as React.MouseEvent);
  }, [handleItemSelect]);

  const clearSelection = useCallback(() => {
    setSelectedItems({});
    setLastSelectedIndex(null);
  }, []);

  return {
    selectedItems,
    handleItemSelect,
    handleCheckboxChange,
    clearSelection,
    updateFilesRef
  };
} 