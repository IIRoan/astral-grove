import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CollectionImportPreviewResponse } from '@riftbound/contracts';
import { useState } from 'react';
import {
  exportCollectionToFile,
  pickAndImportCollectionCsv,
  type ImportProgress,
} from '@/services/collectionImportExport';
import {
  remoteAcceptCollectionTtsImport,
  remotePreviewCollectionImportItems,
  remotePreviewCollectionTtsImport,
} from '@/services/remoteCollectionService';
import { collectionQueryKeys } from '@/src/api/queryKeys';

export function useCollectionImportExport() {
  const queryClient = useQueryClient();
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [ttsSheetOpen, setTtsSheetOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.all,
      exact: true,
    });
    void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.ownershipRoot });
    void queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.recentAddsRoot,
    });
  };

  const importCsv = useMutation({
    mutationFn: () =>
      pickAndImportCollectionCsv((progress) => {
        setImportProgress(progress);
      }),
    meta: { action: 'collection.import_csv' },
    onMutate: () => {
      setImportProgress({
        phase: 'reading',
        current: 0,
        total: 1,
        message: 'Starting import…',
      });
    },
    onSettled: () => {
      setImportProgress(null);
    },
    onSuccess: () => {
      invalidate();
    },
  });

  const previewTts = useMutation({
    mutationFn: (tts: string) => remotePreviewCollectionTtsImport(tts),
    meta: { action: 'collection.import_tts_preview' },
  });

  /** Preview for producers that already resolved variant numbers (camera scan). */
  const previewItems = useMutation({
    mutationFn: (items: CollectionImportPreviewResponse['data']['items']) =>
      remotePreviewCollectionImportItems(items),
    meta: { action: 'collection.import_items_preview' },
  });

  const acceptTts = useMutation({
    mutationFn: (items: CollectionImportPreviewResponse['data']['items']) =>
      remoteAcceptCollectionTtsImport(items),
    meta: { action: 'collection.import_tts_accept' },
    onSuccess: () => {
      invalidate();
    },
  });

  const exportCsv = useMutation({
    mutationFn: exportCollectionToFile,
    meta: { action: 'collection.export_csv' },
  });

  return {
    importCsv,
    exportCsv,
    importProgress,
    ttsSheetOpen,
    setTtsSheetOpen,
    previewTts,
    previewItems,
    acceptTts,
  };
}
