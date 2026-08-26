export const CARD_HEIGHT_FOR_WIDTH = 7 / 5;

export const LEGEND_ART_WINDOW = {
  left: 0.24,
  top: 0.06,
  width: 0.72,
  height: 0.4,
} as const;

export type LegendListArtLayout = {
  cardWidth: number;
  cardHeight: number;
  offsetX: number;
  offsetY: number;
};

export function legendListArtLayout(
  railWidth: number,
  railHeight: number
): LegendListArtLayout {
  if (railWidth <= 0 || railHeight <= 0) {
    return { cardWidth: 0, cardHeight: 0, offsetX: 0, offsetY: 0 };
  }

  const { left, top, width, height } = LEGEND_ART_WINDOW;
  const cardFromWidth = railWidth / width;
  const cardFromHeight = railHeight / (height * CARD_HEIGHT_FOR_WIDTH);
  const cardWidth = Math.max(cardFromWidth, cardFromHeight);
  const cardHeight = cardWidth * CARD_HEIGHT_FOR_WIDTH;
  const extraX = railWidth - cardWidth * width;
  const extraY = railHeight - cardHeight * height;

  return {
    cardWidth: Math.round(cardWidth),
    cardHeight: Math.round(cardHeight),
    offsetX: Math.round(-left * cardWidth + extraX / 2),
    offsetY: Math.round(-top * cardHeight + Math.min(extraY, 0) * 0.2),
  };
}
