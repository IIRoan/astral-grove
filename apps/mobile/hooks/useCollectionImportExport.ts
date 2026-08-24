import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { logActionFailure } from '@/lib/logger';
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
    onError: (error) => {
      logActionFailure('collection.import_csv', error);
    },
  });

  const exportCsv = useMutation({
    mutationFn: exportCollectionToFile,
    onError: (error) => {
      logActionFailure('collection.export_csv', error);
    },
  });

  const clearCollection = useMutation({
    mutationFn: clearCollectionDevOnly,
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      logActionFailure('collection.clear', error);
    },
  });

  return { importCsv, exportCsv, clearCollection, importProgress };
}
