import {
  chunkArray,
  COLLECTION_IMPORT_BATCH_SIZE,
  parseCollectionCsvToImportItems,
} from '@riftbound/contracts';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { mapPool } from '@/lib/asyncPool';
import {
  remoteExportCollectionCsv,
  remoteImportCollectionItems,
  remoteClearCollection,
} from '@/services/remoteCollectionService';

const isWeb = Platform.OS === 'web';

export type ImportProgress = {
  phase: 'reading' | 'parsing' | 'importing';
  current: number;
  total: number;
  message: string;
};

function exportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `piltover-collection-${date}.csv`;
}

export async function exportCollectionToFile(): Promise<void> {
  const csv = await remoteExportCollectionCsv();
  const filename = exportFilename();

  if (isWeb && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export collection',
      UTI: 'public.comma-separated-values-text',
    });
  }
}

export async function pickAndImportCollectionCsv(
  onProgress?: (progress: ImportProgress) => void
): Promise<{
  imported: number;
  totalCopies: number;
  rowsProcessed: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
}> {
  onProgress?.({
    phase: 'reading',
    current: 0,
    total: 1,
    message: 'Reading CSV file…',
  });

  const csv =
    isWeb && typeof document !== 'undefined'
      ? await pickCsvOnWeb()
      : await readCsvFromDocumentPicker();

  onProgress?.({
    phase: 'parsing',
    current: 0,
    total: 1,
    message: 'Parsing collection…',
  });

  const parsed = parseCollectionCsvToImportItems(csv);
  if (parsed.errors.length > 0 && parsed.items.length === 0) {
    throw new Error(parsed.errors[0]?.message ?? 'Failed to parse CSV');
  }

  const chunks = chunkArray(parsed.items, COLLECTION_IMPORT_BATCH_SIZE);
  let imported = 0;
  let importedCopies = 0;
  let failedRows = parsed.errors.length;
  const errors = [...parsed.errors];

  const chunkResults = await mapPool(chunks, 6, async (chunk) => {
    const result = await remoteImportCollectionItems(chunk);
    importedCopies += chunk.reduce((sum, item) => sum + item.quantity, 0);
    onProgress?.({
      phase: 'importing',
      current: importedCopies,
      total: parsed.totalCopies,
      message: `Importing ${importedCopies.toLocaleString()} of ${parsed.totalCopies.toLocaleString()} copies (${parsed.uniquePrintings.toLocaleString()} printings)…`,
    });
    return result;
  });

  for (const result of chunkResults) {
    imported += result.imported;
    failedRows += result.failedRows;
    errors.push(...result.errors);
  }

  onProgress?.({
    phase: 'importing',
    current: parsed.totalCopies,
    total: parsed.totalCopies,
    message: `Imported ${parsed.totalCopies.toLocaleString()} copies`,
  });

  return {
    imported,
    totalCopies: parsed.totalCopies,
    rowsProcessed: parsed.rowsProcessed,
    failedRows,
    errors,
  };
}

async function readCsvFromDocumentPicker(): Promise<string> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error('Import cancelled');
  }

  return FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function clearCollectionDevOnly(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Clear collection is disabled in production');
  }
  await remoteClearCollection();
}

function pickCsvOnWeb(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('Import cancelled'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve(String(reader.result ?? ''));
      };
      reader.onerror = () => {
        reject(new Error('Failed to read CSV file'));
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
