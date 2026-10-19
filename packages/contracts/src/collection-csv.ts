import { CollectionImportItemInput, type CardCondition } from './collection.js';

export const COLLECTION_CSV_HEADERS = [
  'Variant Number',
  'Card Name',
  'Set',
  'Set Prefix',
  'Rarity',
  'Variant Type',
  'Variant Label',
  'Foil',
  'Quantity',
  'Language',
  'Condition',
  'Grading Company',
  'Grading Value',
  'Grading Label',
  'Notes',
] as const;

export type CollectionCsvHeader = (typeof COLLECTION_CSV_HEADERS)[number];

export type CollectionCsvRow = Record<CollectionCsvHeader, string>;

export type CollectionExportRow = {
  variantNumber: string;
  cardName: string;
  setName: string;
  setPrefix: string;
  rarity: string;
  variantType: string;
  variantLabel: string;
  isFoil: boolean;
  quantity: number;
  language: string;
  condition: CardCondition;
  gradeCompany: string | null;
  gradeScore: string | null;
  notes: string | null;
};

export type CollectionImportItem = {
  variantNumber: string;
  quantity: number;
  condition: CardCondition;
  language: string;
  isFoil?: boolean;
  notes?: string | null;
  isGraded?: boolean;
  gradeCompany?: string | null;
  gradeScore?: string | null;
};

export type CollectionImportRowError = {
  row: number;
  message: string;
};

export const COLLECTION_IMPORT_BATCH_SIZE = 100;

const CONDITION_TO_LABEL: Record<CardCondition, string> = {
  mint: 'Mint',
  near_mint: 'Near Mint',
  lightly_played: 'Lightly Played',
  moderately_played: 'Moderately Played',
  heavily_played: 'Heavily Played',
  damaged: 'Damaged',
  unspecified: '',
};

const LABEL_TO_CONDITION = new Map<string, CardCondition>(
  Object.entries(CONDITION_TO_LABEL)
    .filter(([, label]) => label.length > 0)
    .map(([code, label]) => [label.toLowerCase(), code as CardCondition])
);

const LANGUAGE_TO_LABEL: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
};

const LABEL_TO_LANGUAGE = new Map<string, string>(
  Object.entries(LANGUAGE_TO_LABEL).map(([code, label]) => [label.toLowerCase(), code])
);

export function formatConditionLabel(condition: CardCondition): string {
  return CONDITION_TO_LABEL[condition];
}

export function parseConditionLabel(raw: string): CardCondition {
  const trimmed = raw.trim();
  if (!trimmed) return 'unspecified';
  const parsed = LABEL_TO_CONDITION.get(trimmed.toLowerCase());
  if (parsed) return parsed;
  const snake = trimmed.toLowerCase().replace(/\s+/g, '_') as CardCondition;
  if (snake in CONDITION_TO_LABEL) return snake;
  throw new Error(`Unknown condition: ${raw}`);
}

export function formatLanguageLabel(code: string): string {
  return LANGUAGE_TO_LABEL[code.toLowerCase()] ?? code;
}

export function parseLanguageLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'en';
  const fromLabel = LABEL_TO_LANGUAGE.get(trimmed.toLowerCase());
  if (fromLabel) return fromLabel;
  return trimmed.toLowerCase();
}

export function parseFoilLabel(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (['true', 'yes', '1', 'foil'].includes(normalized)) return true;
  if (
    ['', 'false', 'no', '0', 'non-foil', 'nonfoil', 'standard'].includes(normalized)
  ) {
    return false;
  }
  throw new Error(`Invalid foil value: ${raw}`);
}

export function exportRowToCsvRow(row: CollectionExportRow): CollectionCsvRow {
  return {
    'Variant Number': row.variantNumber,
    'Card Name': row.cardName,
    Set: row.setName,
    'Set Prefix': row.setPrefix,
    Rarity: row.rarity,
    'Variant Type': row.variantType,
    'Variant Label': row.variantLabel,
    Foil: row.isFoil ? 'true' : 'false',
    Quantity: String(row.quantity),
    Language: formatLanguageLabel(row.language),
    Condition: formatConditionLabel(row.condition),
    'Grading Company': row.gradeCompany ?? '',
    'Grading Value': row.gradeScore ?? '',
    'Grading Label': '',
    Notes: row.notes ?? '',
  };
}

export function csvRowToImportItem(
  row: CollectionCsvRow,
  rowNumber: number
): { item: CollectionImportItem } | { error: CollectionImportRowError } {
  const variantNumber = row['Variant Number'].trim();
  if (!variantNumber) {
    return { error: { row: rowNumber, message: 'Missing variant number' } };
  }

  const quantityRaw = row.Quantity.trim();
  const quantity = quantityRaw ? Number.parseInt(quantityRaw, 10) : 0;
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { error: { row: rowNumber, message: `Invalid quantity: ${row.Quantity}` } };
  }
  if (quantity === 0) {
    return { error: { row: rowNumber, message: 'Quantity must be greater than zero' } };
  }

  let condition: CardCondition;
  try {
    condition = parseConditionLabel(row.Condition);
  } catch (err) {
    return {
      error: {
        row: rowNumber,
        message: err instanceof Error ? err.message : 'Invalid condition',
      },
    };
  }

  const language = parseLanguageLabel(row.Language);
  let isFoil: boolean;
  try {
    isFoil = parseFoilLabel(row.Foil);
  } catch (err) {
    return {
      error: {
        row: rowNumber,
        message: err instanceof Error ? err.message : 'Invalid foil value',
      },
    };
  }
  const gradeCompany = row['Grading Company'].trim() || null;
  const gradeScore = row['Grading Value'].trim() || null;
  const notes = row.Notes.trim() || null;
  const item = {
    variantNumber,
    quantity,
    condition,
    language,
    isFoil,
    notes,
    isGraded: Boolean(gradeCompany || gradeScore),
    gradeCompany,
    gradeScore,
  };
  // Reject oversized fields per row so one bad row cannot fail its whole import chunk.
  const checked = CollectionImportItemInput.safeParse(item);
  if (!checked.success) {
    const issue = checked.error.issues[0];
    return {
      error: {
        row: rowNumber,
        message: `Invalid ${String(issue?.path[0] ?? 'row')}: ${issue?.message ?? 'invalid value'}`,
      },
    };
  }
  return { item };
}

export function aggregateImportItems(
  items: CollectionImportItem[]
): CollectionImportItem[] {
  const merged = new Map<string, CollectionImportItem>();

  for (const item of items) {
    const finish = item.isFoil === undefined ? 'auto' : item.isFoil ? 'foil' : 'std';
    const key = `${item.variantNumber}|${item.condition}|${item.language}|${finish}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }
    existing.quantity += item.quantity;
    if (!existing.notes && item.notes) existing.notes = item.notes;
    if (!existing.gradeCompany && item.gradeCompany)
      existing.gradeCompany = item.gradeCompany;
    if (!existing.gradeScore && item.gradeScore) existing.gradeScore = item.gradeScore;
    existing.isGraded = Boolean(existing.gradeCompany || existing.gradeScore);
  }

  return [...merged.values()];
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCollectionCsv(rows: CollectionCsvRow[]): string {
  const header = COLLECTION_CSV_HEADERS.join(',');
  const lines = rows.map((row) =>
    COLLECTION_CSV_HEADERS.map((key) => escapeCsvField(row[key] ?? '')).join(',')
  );
  return [header, ...lines].join('\n');
}

function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n' || (char === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        records.push(row);
      }
      row = [];
      if (char === '\r') i += 1;
      continue;
    }

    if (char === '\r') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        records.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.length > 0)) {
    records.push(row);
  }

  return records;
}

export function parseCollectionCsv(content: string): {
  rows: CollectionCsvRow[];
  errors: CollectionImportRowError[];
} {
  const records = parseCsvRecords(content.trim());
  if (records.length === 0) {
    return { rows: [], errors: [] };
  }

  const [headerRow, ...dataRows] = records;
  if (!headerRow) {
    return { rows: [], errors: [] };
  }

  const headerIndex = new Map<string, number>();
  headerRow.forEach((header, index) => {
    headerIndex.set(header.trim(), index);
  });

  const missingHeaders = COLLECTION_CSV_HEADERS.filter((h) => !headerIndex.has(h));
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [
        { row: 1, message: `Missing CSV headers: ${missingHeaders.join(', ')}` },
      ],
    };
  }

  const rows: CollectionCsvRow[] = [];
  const errors: CollectionImportRowError[] = [];

  dataRows.forEach((cells) => {
    const row = {} as CollectionCsvRow;
    for (const header of COLLECTION_CSV_HEADERS) {
      const cellIndex = headerIndex.get(header)!;
      row[header] = cells[cellIndex]?.trim() ?? '';
    }
    rows.push(row);
  });

  return { rows, errors };
}

export function parseCollectionCsvToImportItems(content: string): {
  items: CollectionImportItem[];
  errors: CollectionImportRowError[];
  rowsProcessed: number;
  totalCopies: number;
  uniquePrintings: number;
} {
  const { rows, errors: headerErrors } = parseCollectionCsv(content);
  if (headerErrors.length > 0) {
    return {
      items: [],
      errors: headerErrors,
      rowsProcessed: 0,
      totalCopies: 0,
      uniquePrintings: 0,
    };
  }

  const items: CollectionImportItem[] = [];
  const errors: CollectionImportRowError[] = [...headerErrors];

  rows.forEach((row, index) => {
    const result = csvRowToImportItem(row, index + 2);
    if ('error' in result) {
      errors.push(result.error);
      return;
    }
    items.push(result.item);
  });

  const aggregated = aggregateImportItems(items);
  const totalCopies = aggregated.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: aggregated,
    errors,
    rowsProcessed: rows.length,
    totalCopies,
    uniquePrintings: aggregated.length,
  };
}

export function exportRowsToCsv(rows: CollectionExportRow[]): string {
  return serializeCollectionCsv(rows.map(exportRowToCsvRow));
}
