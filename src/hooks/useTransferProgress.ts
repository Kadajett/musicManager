import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export interface TransferProgress {
  status: string;
  current_file: string | null;
  processed_files: number;
  total_files: number;
  processed_size: number;
  total_size: number;
}

export function useTransferProgress() {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    const listenForProgress = async () => {
      const unlisten = await listen<TransferProgress>('transfer-progress', (event) => {
        setTransferProgress(event.payload);
        setIsTransferring(event.payload.processed_files < event.payload.total_files);
      });
      return unlisten;
    };

    const unsubscribe = listenForProgress();

    return () => {
      unsubscribe.then(unlisten => unlisten());
    };
  }, []);

  return { transferProgress, isTransferring };
} 