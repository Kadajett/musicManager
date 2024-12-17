import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AudioMetadata, FileItem, MetadataWriteOptions } from '../types/music';

interface MetadataEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem;
  onSave: () => void;
}

interface MetadataStats {
  [key: string]: {
    values: Set<string | number | undefined>;
    total: number;
  };
}

export function MetadataEditorModal({ isOpen, onClose, file, onSave }: MetadataEditorModalProps) {
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<AudioMetadata[]>([]);
  const [stats, setStats] = useState<MetadataStats>({});
  const [formValues, setFormValues] = useState<MetadataWriteOptions>({
    path: file.path,
    title: undefined,
    artist: undefined,
    album: undefined,
    album_artist: undefined,
    genre: undefined,
    year: undefined,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMetadata();
    }
  }, [isOpen, file]);

  const loadMetadata = async () => {
    setLoading(true);
    try {
      console.log('Loading metadata for path:', file.path);
      const result = await invoke<AudioMetadata[]>('get_metadata_for_directory', {
        path: file.path,
        sortBy: 'Title'
      });
      console.log('Received metadata:', result);
      setMetadata(result);
      
      // Calculate stats for each field
      const stats: MetadataStats = {};
      const fields: (keyof AudioMetadata)[] = ['artist', 'album_artist', 'album', 'genre', 'year'];
      
      fields.forEach(field => {
        const values = new Set(result.map(m => m[field]));
        console.log(`Stats for ${field}:`, values);
        stats[field] = {
          values,
          total: result.length
        };
      });
      
      setStats(stats);
    } catch (err) {
      console.error('Error loading metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only include fields that have been explicitly set
      const cleanedValues: MetadataWriteOptions = {
        path: file.path,
        ...Object.fromEntries(
          Object.entries(formValues)
            .filter(([key, value]) => 
              // Only include path and fields that have been explicitly set
              key === 'path' || value !== undefined
            )
        )
      };

      await invoke('write_audio_metadata', { options: cleanedValues });
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving metadata:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof MetadataWriteOptions, value: string | number | undefined) => {
    setFormValues(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Edit Metadata - {file.name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Changes will apply to all audio files in this folder. Empty fields will keep their existing values.
          </p>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-4">Loading metadata...</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(stats).map(([field, stat]) => (
                <div key={field} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {field.replace('_', ' ')}
                    </label>
                    <span className="text-xs text-gray-500">
                      {stat.values.size} unique value{stat.values.size !== 1 ? 's' : ''} across {stat.total} files
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type={field === 'year' ? 'number' : 'text'}
                      value={formValues[field as keyof MetadataWriteOptions] || ''}
                      onChange={(e) => handleInputChange(
                        field as keyof MetadataWriteOptions,
                        field === 'year'
                          ? e.target.value ? parseInt(e.target.value) : undefined
                          : e.target.value
                      )}
                      placeholder={`Keep existing (${Array.from(stat.values).filter(v => v !== undefined).join(', ')})`}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    {stat.values.size > 0 && (
                      <select
                        onChange={(e) => handleInputChange(
                          field as keyof MetadataWriteOptions,
                          e.target.value === '' ? undefined : 
                            field === 'year'
                              ? parseInt(e.target.value)
                              : e.target.value
                        )}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select existing...</option>
                        {Array.from(stat.values)
                          .filter(v => v !== undefined)
                          .sort()
                          .map(value => (
                            <option key={value?.toString()} value={value?.toString()}>
                              {value}
                            </option>
                          ))
                        }
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
              dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
              dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
} 