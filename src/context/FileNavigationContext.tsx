import React, { createContext, useContext, ReactNode } from 'react';
import { FileItem } from '../types/music';
import { SortOption } from '../types/fileBrowser';
import { useFileNavigation } from '../hooks/useFileNavigation';

interface FileNavigationContextType {
  currentPath: string;
  files: FileItem[];
  history: string[];
  isLoading: boolean;
  error: string;
  recentLocations: string[];
  isDefault: boolean;
  navigateToDirectory: (path: string, sortBy: SortOption) => void;
  handleBack: () => string | null;
  setAsDefault: (path: string) => Promise<void>;
  setHistory: React.Dispatch<React.SetStateAction<string[]>>;
}

const FileNavigationContext = createContext<FileNavigationContextType | undefined>(undefined);

export function FileNavigationProvider({ children }: { children: ReactNode }) {
  const navigation = useFileNavigation();
  
  return (
    <FileNavigationContext.Provider value={navigation}>
      {children}
    </FileNavigationContext.Provider>
  );
}

export function useFileNavigationContext() {
  const context = useContext(FileNavigationContext);
  if (context === undefined) {
    throw new Error('useFileNavigationContext must be used within a FileNavigationProvider');
  }
  return context;
} 