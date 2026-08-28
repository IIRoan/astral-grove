import { describe, expect, test } from 'bun:test';
import type { CardListItem, CardListPrinting } from '@riftbound/contracts';
import {
  attachOwnedToPrintings,
  buildPrintingPickerOptions,
  getOwnedPrintingsForPicker,
  getRemovePrintingPickerOptions,
  resolvePrintingPickerState,
  resolvePrintingSelection,
  resolveQuickAddPrintings,
  resolveQuickAddSelection,
  resolveQuickRemoveSelection,
  resolveUnambiguousQuantitySelection,
  shouldShowPrintingPicker,
  shouldShowRemovePrintingPicker,
} from '@/utils/collectionPrintingPicker';

const stdFoilPrintings: CardListPrinting[] = [
  {
    variantNumber: 'OGN-253',
    variantLabel: 'Standard',
    isFoil: false,
    priceEur: { currency: 'EUR', low: 1, market: 1.25, avg7d: 1.1, isFoil: false },
  },
  {
    variantNumber: 'OGN-253-Foil',
    variantLabel: 'Standard',
    isFoil: true,
    priceEur: { currency: 'EUR', low: 3, market: 4.5, avg7d: 4, isFoil: true },
  },
];

const runePrintings: CardListPrinting[] = [
  {
    variantNumber: 'SFD-R05',
    variantLabel: 'Standard',
    isFoil: false,
    priceEur: null,
  },
  {
    variantNumber: 'SFD-R05a',
    variantLabel: 'Foil',
    isFoil: true,
    priceEur: null,
  },
];

const multiFamilyPrintings: CardListPrinting[] = [
  ...stdFoilPrintings,
  {
    variantNumber: 'OGN-253-Release',
    variantLabel: 'Release Event Promo',
    isFoil: false,
    priceEur: null,
  },
];

function cardWithPrintings(
  printings: CardListPrinting[],
  variantNumber = printings[0]?.variantNumber ?? 'OGN-253'
): CardListItem {
  return {
    cardId: '11111111-1111-1111-1111-111111111111',
    variantNumber,
    name: 'Test Card',
    type: 'Unit',
    energy: 2,
    might: 2,
    power: 2,
    rarity: 'Rare',
    setCode: 'OGN',
    colors: ['Body'],
    imageUrl: 'https://example.com/card.webp',
    cardmarketId: null,
    priceEur: printings[0]?.priceEur ?? null,
    printings,
    isBanned: false,
  };
}

describe('shouldShowPrintingPicker', () => {
  test('shows picker for std + foil finishes when no variant is pinned', () => {
    expect(shouldShowPrintingPicker(stdFoilPrintings)).toBe(true);
  });

  test('hides picker for a single printing', () => {
    expect(shouldShowPrintingPicker([stdFoilPrintings[0]!])).toBe(false);
  });

  test('hides picker when the active printing row is fixed', () => {
    expect(shouldShowPrintingPicker(stdFoilPrintings, 'OGN-253-Foil')).toBe(false);
  });
});

describe('buildPrintingPickerOptions', () => {
  test('labels std and foil finishes for the add dropdown', () => {
    expect(buildPrintingPickerOptions(stdFoilPrintings)).toEqual([
      {
        id: 'OGN-253::std',
        label: 'Standard',
        subtitle: 'OGN-253',
        price: '€1.25',
      },
      {
        id: 'OGN-253-Foil::foil',
        label: 'Foil',
        subtitle: 'OGN-253-Foil',
        price: '€4.50',
      },
    ]);
  });
});

describe('owned printing picker helpers', () => {
  test('remove picker only appears when multiple owned finishes exist', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([
        ['OGN-253', { quantity: 1 }],
        ['OGN-253-Foil', { quantity: 2 }],
      ])
    );

    expect(shouldShowRemovePrintingPicker(printings)).toBe(true);
  });

  test('remove picker stays hidden when only one finish is owned', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([['OGN-253', { quantity: 1 }]])
    );

    expect(shouldShowRemovePrintingPicker(printings)).toBe(false);
  });

  test('owned helper ignores zero and missing quantities', () => {
    const printings: Array<CardListPrinting & { owned?: number }> = [
      { ...stdFoilPrintings[0]!, owned: 0 },
      { ...stdFoilPrintings[1]!, owned: undefined },
      {
        variantNumber: 'OGN-999',
        variantLabel: 'Standard',
        isFoil: false,
        priceEur: null,
        owned: 2,
      },
    ];

    expect(getOwnedPrintingsForPicker(printings).map((p) => p.variantNumber)).toEqual([
      'OGN-999',
    ]);
  });

  test('remove options only include owned finishes', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([['OGN-253-Foil', { quantity: 1 }]])
    );
    const allOptions = buildPrintingPickerOptions(stdFoilPrintings);

    expect(getRemovePrintingPickerOptions(printings, allOptions)).toEqual([
      {
        id: 'OGN-253-Foil::foil',
        label: 'Foil',
        subtitle: 'OGN-253-Foil',
        price: '€4.50',
      },
    ]);
  });
});

describe('resolveQuickAddPrintings', () => {
  test('includes std and foil finishes for quick add on catalog cards', () => {
    const card = cardWithPrintings(stdFoilPrintings);

    expect(resolveQuickAddPrintings(card).map((p) => p.variantNumber)).toEqual([
      'OGN-253',
      'OGN-253-Foil',
    ]);
  });

  test('scopes quick add to the selected variant family', () => {
    const card = cardWithPrintings(multiFamilyPrintings);

    expect(
      resolveQuickAddPrintings(card, 'OGN-253-Release').map((p) => p.variantNumber)
    ).toEqual(['OGN-253-Release']);
  });

  test('defaults to the standard family when promo and alt art also exist', () => {
    const card = cardWithPrintings(multiFamilyPrintings);

    expect(resolveQuickAddPrintings(card).map((p) => p.variantNumber)).toEqual([
      'OGN-253',
      'OGN-253-Foil',
    ]);
  });

  test('rune foil siblings stay in one quick-add family', () => {
    const card = cardWithPrintings(runePrintings, 'SFD-R05');
    expect(resolveQuickAddPrintings(card).map((p) => p.variantNumber)).toEqual([
      'SFD-R05',
      'SFD-R05a',
    ]);
  });
});

describe('resolvePrintingPickerState', () => {
  test('enables add picker with both finish options before anything is owned', () => {
    const printings = attachOwnedToPrintings(stdFoilPrintings);

    expect(resolvePrintingPickerState({ printings })).toEqual({
      showAddPicker: true,
      showRemovePicker: false,
      addOptions: buildPrintingPickerOptions(stdFoilPrintings),
      removeOptions: [],
    });
  });

  test('simple add skips the foil picker while leave remove picker intact', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([
        ['OGN-253', { quantity: 1 }],
        ['OGN-253-Foil', { quantity: 1 }],
      ])
    );

    expect(resolvePrintingPickerState({ printings, simpleAdd: true })).toEqual({
      showAddPicker: false,
      showRemovePicker: true,
      addOptions: buildPrintingPickerOptions(stdFoilPrintings),
      removeOptions: buildPrintingPickerOptions(stdFoilPrintings),
    });
  });

  test('enables remove picker only for finishes the user owns', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([
        ['OGN-253', { quantity: 1 }],
        ['OGN-253-Foil', { quantity: 3 }],
      ])
    );

    const state = resolvePrintingPickerState({ printings });

    expect(state.showAddPicker).toBe(true);
    expect(state.showRemovePicker).toBe(true);
    expect(state.removeOptions.map((option) => option.id)).toEqual([
      'OGN-253::std',
      'OGN-253-Foil::foil',
    ]);
  });

  test('pins add/remove to one printing on detail rows', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([['OGN-253-Foil', { quantity: 2 }]])
    );

    expect(
      resolvePrintingPickerState({
        printings,
        fixedVariantNumber: 'OGN-253-Foil',
      })
    ).toEqual({
      showAddPicker: false,
      showRemovePicker: false,
      addOptions: buildPrintingPickerOptions(stdFoilPrintings),
      removeOptions: [],
    });
  });
});

describe('resolveQuickRemoveSelection', () => {
  test('when only foil is owned, remove targets the foil stack not standard', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([['OGN-253-Foil', { quantity: 1 }]])
    );

    expect(resolveQuickRemoveSelection(printings)).toEqual({
      variantNumber: 'OGN-253-Foil',
      isFoil: true,
    });
    expect(shouldShowRemovePrintingPicker(printings)).toBe(false);
  });

  test('when only standard is owned, remove targets standard', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([['OGN-253', { quantity: 2 }]])
    );

    expect(resolveQuickRemoveSelection(printings)).toEqual({
      variantNumber: 'OGN-253',
      isFoil: false,
    });
  });

  test('honors an explicit preferred variant when provided', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([
        ['OGN-253', { quantity: 1 }],
        ['OGN-253-Foil', { quantity: 1 }],
      ])
    );

    expect(resolveQuickRemoveSelection(printings, 'OGN-253-Foil')).toEqual({
      variantNumber: 'OGN-253-Foil',
      isFoil: true,
    });
  });

  test('returns undefined when nothing is owned', () => {
    const printings = attachOwnedToPrintings(stdFoilPrintings);
    expect(resolveQuickRemoveSelection(printings)).toBeUndefined();
  });

  test('with both finishes owned and no preference, uses the first owned stack', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([
        ['OGN-253', { quantity: 1 }],
        ['OGN-253-Foil', { quantity: 3 }],
      ])
    );

    expect(resolveQuickRemoveSelection(printings)).toEqual({
      variantNumber: 'OGN-253',
      isFoil: false,
    });
  });
});

describe('resolveQuickAddSelection', () => {
  test('single printing adds that variant', () => {
    expect(resolveQuickAddSelection([stdFoilPrintings[0]!])).toEqual({
      variantNumber: 'OGN-253',
      isFoil: false,
    });
  });

  test('std+foil without picker choice prefers non-foil primary', () => {
    expect(resolveQuickAddSelection(stdFoilPrintings)).toEqual({
      variantNumber: 'OGN-253',
      isFoil: false,
    });
  });

  test('honors an explicit preferred finish (foil)', () => {
    expect(resolveQuickAddSelection(stdFoilPrintings, 'OGN-253-Foil')).toEqual({
      variantNumber: 'OGN-253-Foil',
      isFoil: true,
    });
  });

  test('foil-only card group still resolves a variant', () => {
    expect(resolveQuickAddSelection([stdFoilPrintings[1]!])).toEqual({
      variantNumber: 'OGN-253-Foil',
      isFoil: true,
    });
  });
});

describe('resolveUnambiguousQuantitySelection', () => {
  test('increments and decrements the sole owned finish', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([['OGN-253-Foil::foil', { quantity: 2 }]])
    );

    expect(resolveUnambiguousQuantitySelection(printings, 1)).toEqual({
      variantNumber: 'OGN-253-Foil',
      isFoil: true,
    });
    expect(resolveUnambiguousQuantitySelection(printings, -1)).toEqual({
      variantNumber: 'OGN-253-Foil',
      isFoil: true,
    });
  });

  test('requires a finish choice when both finishes are owned', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([
        ['OGN-253::std', { quantity: 1 }],
        ['OGN-253-Foil::foil', { quantity: 1 }],
      ])
    );

    expect(resolveUnambiguousQuantitySelection(printings, 1)).toBeUndefined();
    expect(resolveUnambiguousQuantitySelection(printings, -1)).toBeUndefined();
  });
});

describe('same-VN dual finishes (foilMode=both)', () => {
  const bothPrintings: CardListPrinting[] = [
    {
      variantNumber: 'VEN-074',
      variantLabel: 'Standard',
      isFoil: false,
      foilMode: 'both',
      priceEur: null,
    },
    {
      variantNumber: 'VEN-074',
      variantLabel: 'Foil',
      isFoil: true,
      foilMode: 'both',
      priceEur: null,
    },
  ];

  test('picker options use finish keys so std and foil are distinct', () => {
    expect(buildPrintingPickerOptions(bothPrintings).map((o) => o.id)).toEqual([
      'VEN-074::std',
      'VEN-074::foil',
    ]);
  });

  test('quick remove with only foil owned targets the foil finish key', () => {
    const printings = attachOwnedToPrintings(
      bothPrintings,
      new Map([['VEN-074::foil', { quantity: 1 }]])
    );
    expect(resolveQuickRemoveSelection(printings)).toEqual({
      variantNumber: 'VEN-074',
      isFoil: true,
    });
  });

  test('resolvePrintingSelection parses finish keys', () => {
    expect(resolvePrintingSelection('VEN-074::foil', bothPrintings)).toEqual({
      variantNumber: 'VEN-074',
      isFoil: true,
    });
  });
});

describe('foil-only ownership search quick-add scenarios', () => {
  test('owned badge can be 1 while only foil is collected', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([['OGN-253-Foil', { quantity: 1 }]])
    );
    const ownedSum = printings.reduce((sum, p) => sum + (p.owned ?? 0), 0);

    expect(ownedSum).toBe(1);
    expect(shouldShowPrintingPicker(printings)).toBe(true);
    expect(shouldShowRemovePrintingPicker(printings)).toBe(false);
    expect(resolveQuickRemoveSelection(printings)).toEqual({
      variantNumber: 'OGN-253-Foil',
      isFoil: true,
    });
  });

  test('adding foil then removing without picker decrements foil only', () => {
    const ownership = new Map<string, { quantity: number }>();

    const addTarget = resolveQuickAddSelection(stdFoilPrintings, 'OGN-253-Foil');
    expect(addTarget).toEqual({ variantNumber: 'OGN-253-Foil', isFoil: true });
    ownership.set(addTarget!.variantNumber, { quantity: 1 });

    const afterAdd = attachOwnedToPrintings(stdFoilPrintings, ownership);
    expect(afterAdd.find((p) => p.variantNumber === 'OGN-253')?.owned).toBe(0);
    expect(afterAdd.find((p) => p.variantNumber === 'OGN-253-Foil')?.owned).toBe(1);

    const removeTarget = resolveQuickRemoveSelection(afterAdd);
    expect(removeTarget).toEqual({ variantNumber: 'OGN-253-Foil', isFoil: true });
    ownership.set(removeTarget!.variantNumber, { quantity: 0 });

    const afterRemove = attachOwnedToPrintings(stdFoilPrintings, ownership);
    expect(afterRemove.find((p) => p.variantNumber === 'OGN-253-Foil')?.owned).toBe(0);
    expect(afterRemove.reduce((sum, p) => sum + (p.owned ?? 0), 0)).toBe(0);
  });

  test('standard owned + foil add keeps stacks independent for remove picker', () => {
    const printings = attachOwnedToPrintings(
      stdFoilPrintings,
      new Map([
        ['OGN-253', { quantity: 1 }],
        ['OGN-253-Foil', { quantity: 1 }],
      ])
    );
    const state = resolvePrintingPickerState({ printings });

    expect(state.showAddPicker).toBe(true);
    expect(state.showRemovePicker).toBe(true);
    expect(state.removeOptions.map((o) => o.id)).toEqual([
      'OGN-253::std',
      'OGN-253-Foil::foil',
    ]);
  });
});
