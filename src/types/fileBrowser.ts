import { FileItem, AudioMetadata } from './music';

export interface ArtistInfo {
  name: string;
  track_count: number;
}

export type ViewMode = 'files' | 'artists';

export interface SelectedItems {
  [path: string]: FileItem;
}

export type SortOption = 'fileName' | 'title' | 'trackNumber';

export interface FileBrowserProps {
  // Add any props if needed in the future
} 