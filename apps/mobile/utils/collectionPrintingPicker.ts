import type { CardListItem, CardListPrinting } from '@riftbound/contracts';
import { collectionFinishKey, parseCollectionFinishKey } from '@riftbound/contracts';
import {
  formatPrintingLabel,
  formatPrintingPrice,
  getCardPrintings,
  getPrintingsInSearchGroup,
  getVariantFamiliesFromPrintings,
  ownedQuantityForPrinting,
} from '@/utils/variants';

export type PrintingPickerOption = {
  id: string;
  label: string;
  subtitle?: string;
  price?: string;
};

export type PrintingWithOwned = CardListPrinting & { owned?: number };

export type PrintingSelection = {
  variantNumber: string;
  isFoil: boolean;
};

/** Show foil/std picker when multiple finish printings exist and none is pinned. */
export function shouldShowPrintingPicker(
  printings: readonly CardListPrinting[] | undefined,
  fixedVariantNumber?: string
): boolean {
  return fixedVariantNumber == null && (printings?.length ?? 0) > 1;
}

export function printingSelectionId(
  printing: Pick<CardListPrinting, 'variantNumber' | 'isFoil'>
): string {
  return collectionFinishKey(printing.variantNumber, printing.isFoil);
}

export function resolvePrintingSelection(
  id: string | undefined,
  printings: readonly CardListPrinting[] | undefined
): PrintingSelection | undefined {
  if (!id) return undefined;
  const parsed = parseCollectionFinishKey(id);
  if (parsed) return parsed;
  const printing = (printings ?? []).find((row) => row.variantNumber === id);
  if (printing) {
    return { variantNumber: printing.variantNumber, isFoil: printing.isFoil };
  }
  return { variantNumber: id, isFoil: /foil/i.test(id) };
}

export function buildPrintingPickerOptions(
  printings: readonly CardListPrinting[]
): PrintingPickerOption[] {
  return printings.map((printing) => ({
    id: printingSelectionId(printing),
    label: formatPrintingLabel(
      printing.variantLabel,
      printing.isFoil,
      printing.variantNumber
    ),
    subtitle: printing.variantNumber,
    price: formatPrintingPrice(printing.priceEur) ?? undefined,
  }));
}

/** Printings the user currently owns with quantity > 0. */
export function getOwnedPrintingsForPicker(
  printings: readonly PrintingWithOwned[] | undefined
): PrintingWithOwned[] {
  return (printings ?? []).filter((printing) => (printing.owned ?? 0) > 0);
}

/** Resolve finish to decrement without a picker — prefer the single owned finish over primary/std. */
export function resolveQuickRemoveSelection(
  printings: readonly PrintingWithOwned[] | undefined,
  preferredId?: string
): PrintingSelection | undefined {
  if (preferredId) return resolvePrintingSelection(preferredId, printings);
  const owned = getOwnedPrintingsForPicker(printings);
  if (owned.length === 0) return undefined;
  const printing = owned[0]!;
  return { variantNumber: printing.variantNumber, isFoil: printing.isFoil };
}

/** Resolve detail +/- only when finish is unambiguous; if both owned, caller must ask. */
export function resolveUnambiguousQuantitySelection(
  printings: readonly PrintingWithOwned[],
  delta: number
): PrintingSelection | undefined {
  const owned = getOwnedPrintingsForPicker(printings);
  if (owned.length === 1) {
    const printing = owned[0]!;
    return { variantNumber: printing.variantNumber, isFoil: printing.isFoil };
  }
  if (delta > 0 && owned.length === 0 && printings.length === 1) {
    const printing = printings[0]!;
    return { variantNumber: printing.variantNumber, isFoil: printing.isFoil };
  }
  return undefined;
}

/** Resolve finish to increment without a picker — single printing, else non-foil primary. */
export function resolveQuickAddSelection(
  printings: readonly CardListPrinting[] | undefined,
  preferredId?: string
): PrintingSelection | undefined {
  if (preferredId) return resolvePrintingSelection(preferredId, printings);
  if (!printings?.length) return undefined;
  const printing =
    printings.length === 1
      ? printings[0]
      : (printings.find((row) => !row.isFoil) ?? printings[0]);
  if (!printing) return undefined;
  return { variantNumber: printing.variantNumber, isFoil: printing.isFoil };
}

export function shouldShowRemovePrintingPicker(
  printings: readonly PrintingWithOwned[] | undefined,
  fixedVariantNumber?: string
): boolean {
  if (!shouldShowPrintingPicker(printings, fixedVariantNumber)) return false;
  return getOwnedPrintingsForPicker(printings).length > 1;
}

export function getRemovePrintingPickerOptions(
  printings: readonly PrintingWithOwned[],
  allOptions: PrintingPickerOption[]
): PrintingPickerOption[] {
  const ownedIds = new Set(
    getOwnedPrintingsForPicker(printings).map((printing) =>
      printingSelectionId(printing)
    )
  );
  return allOptions.filter((option) => ownedIds.has(option.id));
}

export function attachOwnedToPrintings(
  printings: readonly CardListPrinting[],
  collectionByVariant?: ReadonlyMap<string, { quantity: number }>
): PrintingWithOwned[] {
  return printings.map((printing) => ({
    ...printing,
    owned: ownedQuantityForPrinting(collectionByVariant, printing),
  }));
}

/** Quick-add printings: active variant family only (std + foil, not alt art). */
export function resolveQuickAddPrintings(
  card: CardListItem,
  familyContextVariantNumber?: string | null
): CardListPrinting[] {
  const allPrintings = getCardPrintings(card);
  if (familyContextVariantNumber) {
    return getPrintingsInSearchGroup(allPrintings, familyContextVariantNumber);
  }
  const families = getVariantFamiliesFromPrintings(allPrintings);
  const standardFamily =
    families.find((family) => family.label === 'Standard') ?? families[0];
  return standardFamily?.variants ?? allPrintings;
}

export function resolvePrintingPickerState(input: {
  printings: readonly PrintingWithOwned[];
  fixedVariantNumber?: string;
  /** When true, skip the foil/standard add picker and use resolveQuickAddSelection. */
  simpleAdd?: boolean;
}): {
  showAddPicker: boolean;
  showRemovePicker: boolean;
  addOptions: PrintingPickerOption[];
  removeOptions: PrintingPickerOption[];
} {
  const addOptions = buildPrintingPickerOptions(input.printings);
  const showAddPicker =
    shouldShowPrintingPicker(input.printings, input.fixedVariantNumber) &&
    !input.simpleAdd;
  const showRemovePicker = shouldShowRemovePrintingPicker(
    input.printings,
    input.fixedVariantNumber
  );
  const removeOptions = showRemovePicker
    ? getRemovePrintingPickerOptions(input.printings, addOptions)
    : [];

  return {
    showAddPicker,
    showRemovePicker,
    addOptions,
    removeOptions,
  };
}
