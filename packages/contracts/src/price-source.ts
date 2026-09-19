export function cardmarketPriceScopeLabel(isFoil: boolean): string {
  const finish = isFoil ? 'Foil' : 'Non-foil';
  return `${finish} · Cardmarket price guide · EUR`;
}

export const CARDMARKET_PRICE_SCOPE_NOTE =
  'Trend = Cardmarket price guide estimate. Cheapest listing = lowest offer on the marketplace (any language, any condition). Language and NM filters are not applied.';

export const CARDMARKET_PRICE_DETAIL_NOTE =
  "Prices sync daily from Cardmarket's public price guide (EUR). We show trend for headlines and charts. The cheapest listing can be a foreign-language or heavily played copy — compare both before buying.";
