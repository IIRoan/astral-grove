/** Token printings use numbers like SFD-T03 / UNL-T05. */
const TOKEN_VARIANT_SUFFIX = /-T\d+$/i;

export function isTokenVariantNumber(variantNumber: string): boolean {
  return TOKEN_VARIANT_SUFFIX.test(variantNumber.trim());
}

/** Tokens can't be deckbuilt; catalog marks them `super: "Token"`, some printings only by number. */
export function isTokenCard(card: {
  super?: string | null;
  variantNumber: string;
}): boolean {
  return (
    (card.super ?? '').toLowerCase() === 'token' ||
    isTokenVariantNumber(card.variantNumber)
  );
}

/** Prefix for deck cards whose upstream variant is not in the local catalog yet. */
export const UNRESOLVED_DECK_VARIANT_PREFIX = 'unknown:';

export function unresolvedDeckVariantNumber(variantId: string): string {
  return `${UNRESOLVED_DECK_VARIANT_PREFIX}${variantId}`;
}

export function isUnresolvedDeckVariant(variantNumber: string): boolean {
  return variantNumber.startsWith(UNRESOLVED_DECK_VARIANT_PREFIX);
}
