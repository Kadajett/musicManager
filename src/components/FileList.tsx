import React, { useRef, useCallback, useState } from 'react';
import { FaFolder, FaMusic, FaFile, FaMicrophone, FaPlay, FaPen } from 'react-icons/fa';
import { FileItem } from '../types/music';
import { ArtistInfo, ViewMode, SelectedItems } from '../types/fileBrowser';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  useDroppable,
  DragOverEvent,
  DragStartEvent,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MetadataEditorModal } from './MetadataEditorModal';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { invoke } from '@tauri-apps/api/core';

interface FileListProps {
  files: FileItem[];
  artists: ArtistInfo[];
  viewMode: ViewMode;
  selectedItems: SelectedItems;
  isLoading: boolean;
  error: string;
  onFileClick: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onCheckboxChange: (file: FileItem, index: number, event: React.ChangeEvent<HTMLInputElement>) => void;
  onPlayFolder: (path: string) => void;
  onMoveFile?: (sourceId: string, targetId: string) => void;
  onRefresh?: () => void;
  isDeviceBrowser?: boolean;
}

interface SortableFileItemProps {
  file: FileItem;
  index: number;
  selectedItems: SelectedItems;
  onCheckboxChange: (file: FileItem, index: number, event: React.ChangeEvent<HTMLInputElement>) => void;
  onFileClick: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onPlayFolder: (path: string) => void;
}

interface DroppableFileItemProps extends SortableFileItemProps {
  isOver?: boolean;
  onContextMenu: (file: FileItem) => void;
  isRenaming?: boolean;
  onStartRename?: (file: FileItem) => void;
  onCancelRename?: () => void;
  onSaveRename?: (newName: string) => void;
}

interface FileContextMenuProps {
  file: FileItem;
  onPlayFolder: (path: string) => void;
  onOpenMetadata: (file: FileItem, event: React.MouseEvent) => void;
  onRefresh: () => void;
  onStartRename: () => void;
}

function FileContextMenu({ file, onPlayFolder, onOpenMetadata, onRefresh, onStartRename }: FileContextMenuProps) {
  const handleRestoreExtension = async () => {
    try {
      if (file.is_dir) {
        await invoke('restore_folder_extensions', { folderPath: file.path });
      } else {
        await invoke('restore_file_extension', { path: file.path });
      }
      onRefresh();
    } catch (error) {
      console.error('Error restoring file extension:', error);
    }
  };

  return (
    <ContextMenu.Portal>
      <ContextMenu.Content 
        className="min-w-[220px] bg-white dark:bg-gray-800 rounded-lg p-1 shadow-lg border border-gray-200 dark:border-gray-700"
      >
        {file.is_dir && (
          <ContextMenu.Item 
            className="flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md cursor-pointer"
            onClick={() => onPlayFolder(file.path)}
          >
            <FaPlay className="mr-2" /> Play Folder
          </ContextMenu.Item>
        )}
        <ContextMenu.Item 
          className="flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md cursor-pointer"
          onClick={(e) => onOpenMetadata(file, e)}
        >
          <FaMusic className="mr-2" /> Update Metadata
        </ContextMenu.Item>
        <ContextMenu.Item 
          className="flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md cursor-pointer"
          onClick={onStartRename}
        >
          <FaPen className="mr-2" /> Rename
        </ContextMenu.Item>
        {(!file.is_dir && !file.name.includes('.')) || file.is_dir ? (
          <ContextMenu.Item 
            className="flex items-center px-2 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md cursor-pointer"
            onClick={handleRestoreExtension}
          >
            <FaFile className="mr-2" /> 
            {file.is_dir ? 'Restore Extensions in Folder' : 'Restore Extension'}
          </ContextMenu.Item>
        ) : null}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
}

const getNameWithoutExtension = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? filename : filename.slice(0, lastDotIndex);
  };

function DraggableFileItem({
  file,
  index,
  selectedItems,
  onCheckboxChange,
  onFileClick,
  onPlayFolder,
  isOver,
  onContextMenu,
  onRefresh,
}: DroppableFileItemProps & { onRefresh: () => void }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(getNameWithoutExtension(file.name));

  

  const getExtension = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.slice(lastDotIndex);
  };

  const handleRename = async () => {
    try {
      const extension = getExtension(file.name);
      const newNameWithExtension = file.is_dir ? newName : `${newName}${extension}`;
      
      await invoke('change_file_folder_name', {
        path: file.path,
        newFolderName: newNameWithExtension
      });
      setIsRenaming(false);
      onRefresh();
    } catch (error) {
      console.error('Error renaming file:', error);
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: file.path,
    data: {
      type: file.is_dir ? 'folder' : 'file',
      file,
    },
  });

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          data-path={file.path}
          data-type={file.is_dir ? 'folder' : 'file'}
          className={`
            flex items-center p-2
            transition-all duration-150 ease-in-out
            ${selectedItems[file.path] ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
            ${isDragging ? 'scale-[1.02] shadow-lg' : ''}
          `}
        >
          <div className="flex items-center mr-2 flex-shrink-0">
            <input
              type="checkbox"
              checked={!!selectedItems[file.path]}
              onChange={(e) => onCheckboxChange(file, index, e)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500
                dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div
            {...(isRenaming ? {} : { ...attributes, ...listeners })}
            className={`
              flex items-center space-x-2 flex-1 text-left min-w-0
              ${!isRenaming ? 'cursor-grab active:cursor-grabbing' : ''}
              ${file.is_dir ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}
            `}
          >
            <span className="flex-shrink-0">
              {file.is_dir ? (
                <FaFolder className={`text-sm ${isOver ? 'text-blue-500 dark:text-blue-400' : ''}`} />
              ) : file.is_audio ? (
                <FaMusic className="text-sm" />
              ) : (
                <FaFile className="text-sm" />
              )}
            </span>
            {isRenaming ? (
              <div className="flex-1 flex items-center space-x-2">
                <div className="flex-1 flex items-center">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border rounded-l dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRename();
                      } else if (e.key === 'Escape') {
                        setIsRenaming(false);
                        setNewName(getNameWithoutExtension(file.name));
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {!file.is_dir && (
                    <span className="px-2 py-1 text-sm border-t border-b border-r rounded-r bg-gray-100 dark:bg-gray-600 dark:border-gray-600 dark:text-gray-300">
                      {getExtension(file.name)}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename();
                  }}
                  className="px-2 py-1 text-xs rounded bg-blue-500 text-white"
                >
                  Save
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(false);
                    setNewName(getNameWithoutExtension(file.name));
                  }}
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <span
                onClick={(e) => onFileClick(file, index, e)}
                className="truncate hover:overflow-x-auto hover:whitespace-normal transition-all duration-300 pr-2"
              >
                {file.name}
              </span>
            )}
          </div>
        </div>
      </ContextMenu.Trigger>
      <FileContextMenu 
        file={file} 
        onPlayFolder={onPlayFolder}
        onOpenMetadata={onContextMenu}
        onRefresh={onRefresh}
        onStartRename={() => setIsRenaming(true)}
      />
    </ContextMenu.Root>
  );
}

function DroppableSlot({ 
  id, 
  children, 
  isOver 
}: { 
  id: string; 
  children: React.ReactNode; 
  isOver?: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`
        rounded-lg
        transition-all duration-150 ease-in-out
        ${isOver ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
      `}
    >
      {children}
    </div>
  );
}

function DraggedItemPreview({ file }: { file: FileItem }) {
  return (
    <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center space-x-2 opacity-90">
      <span className="flex-shrink-0">
        {file.is_dir ? (
          <FaFolder className="text-blue-500 dark:text-blue-400" />
        ) : file.is_audio ? (
          <FaMusic className="text-gray-600 dark:text-gray-300" />
        ) : (
          <FaFile className="text-gray-600 dark:text-gray-300" />
        )}
      </span>
      <span className="text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
        {file.name}
      </span>
    </div>
  );
}

export function FileList({
  files,
  artists,
  viewMode,
  selectedItems,
  isLoading,
  error,
  onFileClick,
  onCheckboxChange,
  onPlayFolder,
  onMoveFile,
  onRefresh,
  isDeviceBrowser,
}: FileListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [metadataFile, setMetadataFile] = React.useState<FileItem | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 5,
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverId(null);
      return;
    }

    const sourceFile = files.find(f => f.path === active.id);
    if (!sourceFile) {
      setOverId(null);
      return;
    }

    const targetFile = files.find(f => f.path === over.id);
    if (targetFile) {
      const isValidDrop = 
        (!sourceFile.is_dir && targetFile.is_dir) || // File into folder
        (!sourceFile.is_dir && !targetFile.is_dir) || // File onto file
        (sourceFile.is_dir && targetFile.is_dir); // Folder into folder
      
      setOverId(isValidDrop ? over.id.toString() : null);
    }
  }, [files]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    
    if (!over) return;

    const sourceFile = files.find(f => f.path === active.id);
    const targetFile = files.find(f => f.path === over.id);

    if (!sourceFile || !targetFile) return;

    if (sourceFile.path === targetFile.path) return;

    if (sourceFile.is_dir && targetFile.path.startsWith(sourceFile.path)) return;

    if (isDeviceBrowser) {
      onMoveFile?.(sourceFile.path, targetFile.is_dir ? targetFile.path : targetFile.path);
    } else {
      if (targetFile.is_dir) {
        onMoveFile?.(sourceFile.path, targetFile.path);
      } else if (!sourceFile.is_dir && !targetFile.is_dir) {
        onMoveFile?.(sourceFile.path, targetFile.path);
      }
    }
  }, [files, onMoveFile, isDeviceBrowser]);

  const handleMetadataClose = useCallback(() => {
    setMetadataFile(null);
  }, []);

  const handleMetadataSave = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  if (isLoading) return <div className="flex items-center justify-center h-full"><span className="text-gray-500 dark:text-gray-400">Loading...</span></div>;
  if (error) return <div className="flex items-center justify-center h-full text-red-500 dark:text-red-400">{error}</div>;
  if (viewMode === 'artists') {
    return (
      <div className="grid grid-cols-1 gap-0.5 p-2">
        {artists.map((artist) => (
          <div
            key={artist.name}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div className="flex items-center space-x-3">
              <FaMicrophone className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300 truncate hover:overflow-x-auto hover:whitespace-normal">
                {artist.name}
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
              {artist.track_count} {artist.track_count === 1 ? 'track' : 'tracks'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div ref={parentRef} className="h-full overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <DroppableSlot 
                  id={files[virtualRow.index].path}
                  isOver={overId === files[virtualRow.index].path}
                >
                  <DraggableFileItem
                    file={files[virtualRow.index]}
                    index={virtualRow.index}
                    selectedItems={selectedItems}
                    onCheckboxChange={onCheckboxChange}
                    onFileClick={onFileClick}
                    onPlayFolder={onPlayFolder}
                    isOver={overId === files[virtualRow.index].path}
                    onContextMenu={(file) => setMetadataFile(file)}
                    onRefresh={onRefresh as () => void}
                  />
                </DroppableSlot>
              </div>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeId ? (
              <DraggedItemPreview file={files.find(f => f.path === activeId)!} />
            ) : null}
          </DragOverlay>
        </div>
      </DndContext>

      {metadataFile && (
        <MetadataEditorModal
          isOpen={true}
          onClose={handleMetadataClose}
          file={metadataFile}
          onSave={handleMetadataSave}
        />
      )}
    </>
  );
} 