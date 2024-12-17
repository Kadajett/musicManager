export interface Artist {
  id: string;
  name: string;
  sortName?: string; // For sorting (e.g., "Beatles, The" for "The Beatles")
  genres?: string[];
  biography?: string;
  imageUrl?: string;
  albums: Album[];
  singles: Track[];
}

export interface Album {
  id: string;
  title: string;
  sortTitle?: string;
  artist: Artist;
  releaseDate: Date;
  genres?: string[];
  year: number;
  type: 'album' | 'ep' | 'single' | 'compilation';
  tracks: Track[];
  artwork?: AlbumArtwork;
  metadata: AlbumMetadata;
}

export interface Track {
  id: string;
  title: string;
  sortTitle?: string;
  artist: Artist;
  featuredArtists?: Artist[];
  album?: Album;
  trackNumber: number;
  discNumber: number;
  duration: number; // in seconds
  genres?: string[];
  bpm?: number;
  key?: string;
  isrc?: string; // International Standard Recording Code
  versions: AudioVersion[];
  lyrics?: Lyrics;
  metadata: TrackMetadata;
}

export interface AudioVersion {
  id: string;
  quality: AudioQuality;
  format: AudioFormat;
  filePath: string;
  fileSize: number; // in bytes
  bitrate: number; // in kbps
  sampleRate: number; // in Hz
  channels: number;
  lastModified: Date;
}

export interface AudioQuality {
  type: 'lossless' | 'high' | 'medium' | 'low';
  compression?: number; // compression ratio if applicable
}

export type AudioFormat = 'MP3' | 'FLAC' | 'WAV' | 'AAC' | 'ALAC' | 'OGG' | 'AIFF';

export interface AlbumArtwork {
  id: string;
  original: ImageVersion;
  thumbnails: ImageVersion[];
}

export interface ImageVersion {
  url: string;
  width: number;
  height: number;
  format: 'jpg' | 'png' | 'webp';
  fileSize: number;
}

export interface Lyrics {
  plain: string;
  synchronized?: LyricLine[];
  language: string;
  source?: string;
}

export interface LyricLine {
  text: string;
  startTime: number; // timestamp in milliseconds
  endTime: number;
}

export interface TrackMetadata {
  encodedBy?: string;
  encoder?: string;
  copyright?: string;
  publisher?: string;
  originalReleaseDate?: Date;
  recordLabel?: string;
  mood?: string[];
  tags?: string[];
  rating?: number;
  playCount?: number;
  dateAdded: Date;
  dateModified: Date;
  comments?: string;
  replayGain?: number;
  customFields?: Record<string, string>;
}

export interface AlbumMetadata {
  copyright?: string;
  publisher?: string;
  recordLabel?: string;
  catalogNumber?: string;
  upc?: string; // Universal Product Code
  rating?: number;
  dateAdded: Date;
  dateModified: Date;
  comments?: string;
  customFields?: Record<string, string>;
}

export interface PlaylistItem {
  id: string;
  track: Track;
  addedDate: Date;
  addedBy?: string;
  sortOrder: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  creator: string;
  isPublic: boolean;
  dateCreated: Date;
  dateModified: Date;
  items: PlaylistItem[];
  artwork?: ImageVersion;
}

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  is_audio: boolean;
}

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  album_artist?: string;
  year?: number;
  track_number?: number;
  genre?: string;
  album_art?: string;
  duration?: number;
  audio_bitrate?: number;
  overall_bitrate?: number;
  sample_rate?: number;
  bit_depth?: number;
  channels?: number;
  path?: string;
}

export interface MetadataWriteOptions {
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  album_artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
}

export interface MetadataWriteResult {
  success: boolean;
  message: string;
} 