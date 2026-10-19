import { z } from 'zod';
import { isCardBannedAt, isCardNameInBannedList } from './card-legality.js';
import { cardHasAnyType } from './card-types.js';
import { sharesLegendChampionTag } from './champion-tags.js';
import { isTokenCard, isUnresolvedDeckVariant } from './variant-utils.js';

export const DeckFormat = z.enum(['constructed', 'pre-rift']);
export type DeckFormat = z.infer<typeof DeckFormat>;

export const DECK_FORMAT_OPTIONS = [
  {
    value: 'constructed' as const,
    label: 'Constructed',
    description: 'Standard tournament deck rules.',
  },
  {
    value: 'pre-rift' as const,
    label: 'Pre-Rift',
    description: 'Sealed / Pre-Rift event rules (25+ main, 3 domains, no copy cap).',
  },
] as const;

export function deckFormatLabel(format: DeckFormat): string {
  return DECK_FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format;
}

export const RIFTBOUND_DECK_RULES = {
  version: '2026.1',
  game: 'Riftbound',
  format: 'Constructed',
  sections: {
    legend: {
      key: 'legend',
      title: 'Champion Legend',
      target: 1,
      single: true,
      required: true,
      description: 'One Champion Legend defines your deck Domain Identity.',
    },
    champion: {
      key: 'champion',
      title: 'Chosen Champion',
      target: 1,
      single: true,
      required: true,
      description:
        'One Champion Unit that shares a champion tag with your Legend and matches Domain Identity.',
    },
    mainDeck: {
      key: 'mainDeck',
      title: 'Main Deck',
      target: 39,
      minimum: 39,
      required: true,
      description:
        'At least 39 Main Deck cards. With your Chosen Champion, your playable deck is 40 cards.',
    },
    runes: {
      key: 'runes',
      title: 'Rune Deck',
      target: 12,
      exact: true,
      required: true,
      description:
        'Exactly 12 Rune cards matching your Legend Domain Identity. Split freely across your Legend two domains.',
    },
    battlefields: {
      key: 'battlefields',
      title: 'Battlefields',
      target: 3,
      exact: true,
      required: true,
      uniqueNames: true,
      description: 'Exactly 3 Battlefield cards with unique names.',
    },
    sideboard: {
      key: 'sideboard',
      title: 'Sideboard',
      target: 10,
      maximum: 10,
      required: false,
      description: 'Up to 10 cards that are legal in your Main Deck.',
    },
  },
  copyLimits: {
    /** Max non-rune copies by name; null = unlimited. */
    default: 3 as number | null,
    rune: 12,
    battlefieldPerName: 1,
    /** Max Signature cards across Main Deck + Sideboard; null = unlimited. */
    signatureTotal: 3 as number | null,
  },
  /** Max unique domains; null = restricted to Legend identity. */
  maxDomains: null as number | null,
  requireChampionTagMatch: true,
  requireSignatureTagMatch: true,
  restrictPicker: true,
  constraints: [
    {
      code: 'domain_identity',
      message:
        'All cards in Main Deck, Rune Deck, Battlefields, Sideboard, and Chosen Champion must match your Legend Domain Identity.',
    },
    {
      code: 'champion_tag',
      message: 'Chosen Champion must share at least one champion tag with your Legend.',
    },
    {
      code: 'champion_supertype',
      message: 'Chosen Champion must be a Champion Unit (supertype: Champion).',
    },
    {
      code: 'signature_cap',
      message:
        'At most 3 Signature cards total across Main Deck and Sideboard, matching Legend champion tags.',
    },
    {
      code: 'banned_card',
      message: 'Banned cards cannot be played.',
    },
    {
      code: 'card_type',
      message:
        'Main Deck and Sideboard exclude Legends, Battlefields, Runes and tokens; Rune Deck and Battlefields hold only their type.',
    },
    {
      code: 'battlefield_unique',
      message: 'Each Battlefield name may appear at most once.',
    },
    {
      code: 'copy_limit_spiderling',
      message: 'Your deck can have any number of cards named Spiderling.',
    },
  ],
} as const;

/** Pre-Rift / Sealed rules (launch-week sealed events). */
export const RIFTBOUND_PRE_RIFT_DECK_RULES = {
  version: '2026.1',
  game: 'Riftbound',
  format: 'Pre-Rift',
  sections: {
    legend: {
      key: 'legend',
      title: 'Champion Legend',
      target: 1,
      single: true,
      required: false,
      description:
        'Optional Champion Legend. A Legend covers two of your three domain slots.',
    },
    champion: {
      key: 'champion',
      title: 'Chosen Champion',
      target: 1,
      single: true,
      required: false,
      description:
        'Optional Chosen Champion within your three domains. Does not need to match your Legend champion tag.',
    },
    mainDeck: {
      key: 'mainDeck',
      title: 'Main Deck',
      target: 25,
      minimum: 25,
      required: true,
      description:
        'At least 25 Main Deck cards. You may play more if your pool allows.',
    },
    runes: {
      key: 'runes',
      title: 'Rune Deck',
      target: 12,
      exact: true,
      required: true,
      description: 'Exactly 12 Rune cards from up to three domains.',
    },
    battlefields: {
      key: 'battlefields',
      title: 'Battlefields',
      target: 3,
      maximum: 3,
      exact: false,
      required: false,
      uniqueNames: false,
      description: 'Up to 3 Battlefield cards (optional). Duplicate names are allowed.',
    },
    sideboard: {
      key: 'sideboard',
      title: 'Sideboard',
      target: 8,
      required: false,
      description: 'The rest of your card pool. No size limit.',
    },
  },
  copyLimits: {
    default: null as number | null,
    rune: 12,
    battlefieldPerName: 3,
    signatureTotal: null as number | null,
  },
  maxDomains: 3 as number | null,
  requireChampionTagMatch: false,
  requireSignatureTagMatch: false,
  /** Pre-Rift builders stay exploratory; validation still reports legality. */
  restrictPicker: false,
  constraints: [
    {
      code: 'domain_cap',
      message:
        'Sealed decks may use up to three domains. A Legend or Signature covers two of those domains.',
    },
    {
      code: 'champion_supertype',
      message: 'Chosen Champion must be a Champion Unit (supertype: Champion).',
    },
    {
      code: 'copy_limit_none',
      message: 'No per-card copy limit — play as many copies as you opened.',
    },
  ],
} as const;

export type RiftboundDeckRules =
  typeof RIFTBOUND_DECK_RULES | typeof RIFTBOUND_PRE_RIFT_DECK_RULES;

export const RIFTBOUND_DECK_RULES_BY_FORMAT = {
  constructed: RIFTBOUND_DECK_RULES,
  'pre-rift': RIFTBOUND_PRE_RIFT_DECK_RULES,
} as const satisfies Record<DeckFormat, RiftboundDeckRules>;

export function getDeckRules(format: DeckFormat = 'constructed'): RiftboundDeckRules {
  return RIFTBOUND_DECK_RULES_BY_FORMAT[format];
}

export function deckFormatRestrictsPicker(format: DeckFormat): boolean {
  return getDeckRules(format).restrictPicker;
}

/** Max Sideboard size; null = uncapped (Pre-Rift sideboard is the rest of the pool, TR 602.4.a). */
export function sideboardMaximum(rules: RiftboundDeckRules): number | null {
  const { sideboard } = rules.sections;
  return 'maximum' in sideboard ? sideboard.maximum : null;
}

/** Real catalog marks Signature cards via `super`; older decks only via rarity/variant text. */
export function isSignatureCard(card: {
  isSignature?: boolean;
  super?: string | null;
  rarity?: string;
  variantType?: string;
}): boolean {
  if (card.isSignature) return true;
  return `${card.super ?? ''} ${card.rarity ?? ''} ${card.variantType ?? ''}`
    .toLowerCase()
    .includes('signature');
}

/** Card names with no per-name copy limit (card text). Match is exact. */
export const UNLIMITED_COPY_CARD_NAMES = new Set<string>(['Spiderling']);

/** Max copies by name for format rules; null = unlimited. */
export function copyLimitForCardName(
  name: string,
  options: { isRune: boolean; rules: RiftboundDeckRules }
): number | null {
  if (UNLIMITED_COPY_CARD_NAMES.has(name)) return null;
  return options.isRune
    ? options.rules.copyLimits.rune
    : options.rules.copyLimits.default;
}

export type RiftboundDeckSectionKey = keyof typeof RIFTBOUND_DECK_RULES.sections;

export const DeckCardInput = z.object({
  cardId: z.string(),
  variantNumber: z.string(),
  name: z.string(),
  type: z.string(),
  super: z.string().nullable(),
  tags: z.array(z.string()),
  colors: z.array(z.string()),
  energy: z.number(),
  /** Present on newly synced cards; omitted on older stored decks. */
  power: z.number().int().optional(),
  setCode: z.string(),
  rarity: z.string(),
  variantType: z.string(),
  isSignature: z.boolean(),
  imageUrl: z.string().url().nullable().optional(),
  banEffectiveDate: z.string().nullable().optional(),
});

export const DeckEntryInput = z.object({
  card: DeckCardInput,
  count: z.number().int().positive(),
});

export const DeckValidateInput = z.object({
  format: DeckFormat.default('constructed'),
  legend: DeckCardInput.nullable(),
  champion: DeckCardInput.nullable(),
  mainDeck: z.array(DeckEntryInput),
  runes: z.array(DeckEntryInput),
  battlefields: z.array(DeckEntryInput),
  sideboard: z.array(DeckEntryInput),
});

export const DeckValidationMessage = z.object({
  type: z.enum(['error', 'warning', 'valid']),
  code: z.string(),
  message: z.string(),
});

export type DeckCardInput = z.infer<typeof DeckCardInput>;
export type DeckEntryInput = z.infer<typeof DeckEntryInput>;
export type DeckValidateInput = z.infer<typeof DeckValidateInput>;
export type DeckValidationMessage = z.infer<typeof DeckValidationMessage>;

export function normalizeDeckDomains(colors: readonly string[]): string[] {
  return colors.map((color) => color.trim()).filter(Boolean);
}

export function domainIdentityMatch(
  cardDomains: readonly string[],
  legendDomains: ReadonlySet<string>
): boolean {
  const normalized = normalizeDeckDomains(cardDomains);
  if (!normalized.length) return true;
  return normalized.every((domain) => legendDomains.has(domain));
}

function increment(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sectionCount(entries: DeckEntryInput[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}

function collectDeckDomains(input: DeckValidateInput): Set<string> {
  const domains = new Set<string>();
  const add = (colors: string[]) => {
    for (const domain of normalizeDeckDomains(colors)) domains.add(domain);
  };

  if (input.legend) add(input.legend.colors);
  if (input.champion) add(input.champion.colors);
  for (const { card } of input.mainDeck) add(card.colors);
  for (const { card } of input.runes) add(card.colors);
  for (const { card } of input.battlefields) add(card.colors);
  return domains;
}

function isMainDeckCardType(card: DeckCardInput): boolean {
  return (
    !isTokenCard(card) && !cardHasAnyType(card.type, ['legend', 'battlefield', 'rune'])
  );
}

export type DeckValidateOptions = {
  /** Upstream per-deck banned names (Piltover Archive), on top of each card's ban date. */
  bannedCardNames?: readonly string[];
};

export function validateRiftboundDeck(
  input: DeckValidateInput,
  options: DeckValidateOptions = {}
): DeckValidationMessage[] {
  const messages: DeckValidationMessage[] = [];
  const format = input.format ?? 'constructed';
  const rules = getDeckRules(format);
  const { legend, champion } = input;
  const mainDeckTotal = sectionCount(input.mainDeck);
  const runeTotal = sectionCount(input.runes);
  const battlefieldTotal = sectionCount(input.battlefields);
  const sideboardTotal = sectionCount(input.sideboard);
  const sideboardMax = sideboardMaximum(rules);
  const sideboardIsPool = sideboardMax == null;
  const deckbuiltCards = [
    ...input.mainDeck,
    ...(sideboardIsPool ? [] : input.sideboard),
  ];

  if (!legend) {
    messages.push({
      type: rules.sections.legend.required ? 'error' : 'warning',
      code: 'missing_legend',
      message: 'No Champion Legend selected (need 1).',
    });
  } else if (!cardHasAnyType(legend.type, ['legend'])) {
    messages.push({
      type: 'error',
      code: 'card_type',
      message: `"${legend.name}" is not a Legend.`,
    });
  }

  if (!champion) {
    messages.push({
      type: rules.sections.champion.required ? 'error' : 'warning',
      code: 'missing_champion',
      message: 'No Chosen Champion selected (need 1).',
    });
  } else if (legend && rules.requireChampionTagMatch) {
    const hasMatchingTag = sharesLegendChampionTag(legend, champion);
    if (!hasMatchingTag) {
      messages.push({
        type: 'error',
        code: 'champion_tag_mismatch',
        message: `Chosen Champion "${champion.name}" must share a champion tag with your Legend "${legend.name}".`,
      });
    }
  }

  if (
    champion &&
    !(
      cardHasAnyType(champion.type, ['unit']) &&
      (champion.super ?? '').toLowerCase() === 'champion'
    )
  ) {
    messages.push({
      type: 'error',
      code: 'champion_supertype',
      message: `Chosen Champion "${champion.name}" must be a Champion Unit (supertype: Champion).`,
    });
  }

  if (rules.maxDomains != null) {
    const domains = collectDeckDomains(input);
    if (domains.size > rules.maxDomains) {
      messages.push({
        type: 'error',
        code: 'domain_cap',
        message: `Deck uses ${domains.size} domains (${[...domains].join(', ')}); Pre-Rift allows at most ${rules.maxDomains}.`,
      });
    }
  } else if (legend) {
    const legendDomains = new Set(normalizeDeckDomains(legend.colors));

    for (const { card: entryCard } of deckbuiltCards) {
      if (!domainIdentityMatch(entryCard.colors, legendDomains)) {
        messages.push({
          type: 'error',
          code: 'domain_identity',
          message: `"${entryCard.name}" does not match your Legend's Domain Identity.`,
        });
      }
    }

    for (const { card: entryCard } of input.runes) {
      if (!domainIdentityMatch(entryCard.colors, legendDomains)) {
        messages.push({
          type: 'error',
          code: 'domain_identity',
          message: `Rune "${entryCard.name}" does not match your Legend's Domain Identity.`,
        });
      }
    }

    if (champion && !domainIdentityMatch(champion.colors, legendDomains)) {
      messages.push({
        type: 'error',
        code: 'domain_identity',
        message: `Chosen Champion "${champion.name}" does not match your Legend's Domain Identity.`,
      });
    }
  }

  const allNameCounts = new Map<string, number>();
  if (champion) increment(allNameCounts, champion.name, 1);
  for (const { card, count } of input.mainDeck)
    increment(allNameCounts, card.name, count);
  for (const { card, count } of input.runes) increment(allNameCounts, card.name, count);
  for (const { card, count } of input.battlefields)
    increment(allNameCounts, card.name, count);
  for (const { card, count } of input.sideboard)
    increment(allNameCounts, card.name, count);

  for (const [name, count] of allNameCounts) {
    const isRune = input.runes.some((entry) => entry.card.name === name);
    const isBattlefield = input.battlefields.some((entry) => entry.card.name === name);
    if (isBattlefield) continue;
    const maxCopies = copyLimitForCardName(name, { isRune, rules });
    if (maxCopies != null && count > maxCopies) {
      messages.push({
        type: 'error',
        code: 'copy_limit',
        message: `"${name}" has ${count} copies (max ${maxCopies}).`,
      });
    }
  }

  const sectionTypeChecks: [
    DeckEntryInput[],
    string,
    (card: DeckCardInput) => boolean,
  ][] = [
    [input.mainDeck, 'Main Deck', isMainDeckCardType],
    [sideboardIsPool ? [] : input.sideboard, 'Sideboard', isMainDeckCardType],
    [input.runes, 'Rune Deck', (card) => cardHasAnyType(card.type, ['rune'])],
    [
      input.battlefields,
      'Battlefields',
      (card) => cardHasAnyType(card.type, ['battlefield']),
    ],
  ];
  for (const [entries, title, allowed] of sectionTypeChecks) {
    for (const { card } of entries) {
      if (isUnresolvedDeckVariant(card.variantNumber) || allowed(card)) continue;
      messages.push({
        type: 'error',
        code: 'card_type',
        message: `"${card.name}" cannot be in the ${title}.`,
      });
    }
  }

  const bannedNames = new Set<string>();
  for (const card of [
    legend,
    champion,
    ...[
      input.mainDeck,
      input.runes,
      input.battlefields,
      sideboardIsPool ? [] : input.sideboard,
    ].flatMap((entries) => entries.map((entry) => entry.card)),
  ]) {
    if (!card) continue;
    if (
      isCardBannedAt(card.banEffectiveDate) ||
      isCardNameInBannedList(card.name, options.bannedCardNames)
    ) {
      bannedNames.add(card.name);
    }
  }
  for (const name of bannedNames) {
    messages.push({
      type: 'error',
      code: 'banned_card',
      message: `"${name}" is banned.`,
    });
  }

  let signatureCount = 0;
  for (const { card, count } of deckbuiltCards) {
    if (isSignatureCard(card)) signatureCount += count;
  }
  const signatureCap = rules.copyLimits.signatureTotal;
  if (signatureCap != null && signatureCount > signatureCap) {
    messages.push({
      type: 'error',
      code: 'signature_cap',
      message: `${signatureCount} Signature cards in deck (max ${signatureCap} total).`,
    });
  }

  if (legend && rules.requireSignatureTagMatch) {
    for (const { card } of deckbuiltCards) {
      if (!isSignatureCard(card)) continue;
      const hasMatch = sharesLegendChampionTag(legend, card);
      if (!hasMatch) {
        messages.push({
          type: 'error',
          code: 'signature_tag',
          message: `Signature card "${card.name}" must share a Champion tag with your Legend.`,
        });
      }
    }
  }

  const mainDeckMinimum = rules.sections.mainDeck.minimum;
  if (mainDeckTotal < mainDeckMinimum) {
    messages.push({
      type: 'warning',
      code: 'main_deck_count',
      message:
        format === 'pre-rift'
          ? `Main Deck has ${mainDeckTotal} cards (need at least ${mainDeckMinimum}).`
          : `Main Deck has ${mainDeckTotal} cards (need at least ${mainDeckMinimum}, plus Chosen Champion = 40).`,
    });
  }

  if (runeTotal !== rules.sections.runes.target) {
    messages.push({
      type: runeTotal < rules.sections.runes.target ? 'warning' : 'error',
      code: 'rune_count',
      message: `Rune Deck has ${runeTotal} cards (need exactly ${rules.sections.runes.target}).`,
    });
  }

  if (rules.sections.battlefields.exact) {
    if (battlefieldTotal !== rules.sections.battlefields.target) {
      messages.push({
        type:
          battlefieldTotal < rules.sections.battlefields.target ? 'warning' : 'error',
        code: 'battlefield_count',
        message: `Battlefields: ${battlefieldTotal} (need exactly ${rules.sections.battlefields.target}).`,
      });
    }
  } else {
    const maxBattlefields =
      rules.sections.battlefields.maximum ?? rules.sections.battlefields.target;
    if (battlefieldTotal > maxBattlefields) {
      messages.push({
        type: 'error',
        code: 'battlefield_count',
        message: `Battlefields: ${battlefieldTotal} (max ${maxBattlefields}).`,
      });
    }
  }

  for (const { card, count } of input.battlefields) {
    if (count > rules.copyLimits.battlefieldPerName) {
      messages.push({
        type: 'error',
        code: 'battlefield_unique',
        message: `Battlefield "${card.name}" appears ${count} times (max ${rules.copyLimits.battlefieldPerName}).`,
      });
    }
  }

  if (sideboardMax != null && sideboardTotal > sideboardMax) {
    messages.push({
      type: 'error',
      code: 'sideboard_count',
      message: `Sideboard has ${sideboardTotal} cards (max ${sideboardMax}).`,
    });
  }

  // Missing optional Legend/Champion (Pre-Rift, TR 602.4.a.5) is advisory, not a blocker.
  const blocking = messages.filter(
    (message) =>
      message.type === 'error' ||
      (message.code !== 'missing_legend' && message.code !== 'missing_champion')
  );
  if (blocking.length === 0) {
    messages.push({ type: 'valid', code: 'deck_valid', message: 'Deck is valid!' });
  }

  return messages;
}

export function deckValidationHasErrors(messages: DeckValidationMessage[]): boolean {
  return messages.some((message) => message.type === 'error');
}

export function deckValidationIsValid(messages: DeckValidationMessage[]): boolean {
  return messages.some((message) => message.type === 'valid');
}

export function runeNameForDomain(domain: string): string {
  return `${domain} Rune`;
}

export function legendRuneDomains(
  legend: Pick<DeckCardInput, 'colors'>
): [string, string] {
  const [first, second] = legend.colors;
  return [first ?? 'Unknown', second ?? first ?? 'Unknown'];
}
