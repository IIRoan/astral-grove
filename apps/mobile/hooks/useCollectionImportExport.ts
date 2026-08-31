import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  clearCollectionDevOnly,
  exportCollectionToFile,
  pickAndImportCollectionCsv,
  type ImportProgress,
} from '@/services/collectionImportExport';
import { collectionQueryKeys } from '@/src/api/queryKeys';

export function useCollectionImportExport() {
  const queryClient = useQueryClient();
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

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

  const exportCsv = useMutation({
    mutationFn: exportCollectionToFile,
    meta: { action: 'collection.export_csv' },
  });

  const clearCollection = useMutation({
    mutationFn: clearCollectionDevOnly,
    meta: { action: 'collection.clear' },
    onSuccess: () => {
      invalidate();
    },
  });

  return { importCsv, exportCsv, clearCollection, importProgress };
}
