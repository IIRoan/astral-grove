import type { FilterSnapshot } from '@riftbound/contracts';
import { computeCatalogTotal, sumSetPrintCounts } from '../../src/lib/catalog-total.js';

export const enrichedFilterSnapshot: FilterSnapshot = {
  colors: [
    { id: 'body', name: 'Body', count: 179 },
    { id: 'calm', name: 'Calm', count: 177 },
  ],
  types: [
    { id: 'unit', name: 'Unit', count: 503 },
    { id: 'spell', name: 'Spell', count: 192 },
  ],
  supertypes: [{ id: 'champion', name: 'Champion', count: 234 }],
  rarities: [
    { id: 'common', name: 'Common', count: 236 },
    { id: 'rare', name: 'Rare', count: 212 },
  ],
  variants: [
    { id: 'standard', name: 'Standard', count: 786 },
    { id: 'alt-art', name: 'Alt Art', count: 96 },
    { id: 'overnumbered', name: 'Overnumbered', count: 97 },
  ],
  sets: [
    { id: 'ogn', code: 'OGN', name: 'Origins', count: 354, printCount: 544 },
    { id: 'sfd', code: 'SFD', name: 'Spiritforged', count: 302, printCount: 434 },
    { id: 'unl', code: 'UNL', name: 'Unleashed', count: 299, printCount: 306 },
    {
      id: 'ogn-nn',
      code: 'OGN-NN',
      name: 'Origins | Nexus Night',
      count: 7,
      printCount: 25,
    },
    {
      id: 'sfd-nn',
      code: 'SFD-NN',
      name: 'Spiritforged | Nexus Night',
      count: 0,
      printCount: 33,
    },
    {
      id: 'unl-nn',
      code: 'UNL-NN',
      name: 'Unleashed | Nexus Night',
      count: 1,
      printCount: 19,
    },
    { id: 'ogs', code: 'OGS', name: 'Proving Grounds', count: 24, printCount: 25 },
    { id: 'arc', code: 'ARC', name: 'Arcane Box Set', count: 6, printCount: 6 },
    { id: 'wrld', code: 'WRLD25', name: 'Worlds Bundle 2025', count: 4, printCount: 4 },
  ],
};

/** Derived from snapshot print counts — never hardcode the live catalog total. */
export const expectedCatalogTotal = computeCatalogTotal(enrichedFilterSnapshot);

export const expectedSetPrintTotal = sumSetPrintCounts(enrichedFilterSnapshot);
