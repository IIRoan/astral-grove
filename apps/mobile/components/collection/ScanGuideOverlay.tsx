import { View } from 'react-native';
import type { CardListItem } from '@riftbound/contracts';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { guideRect } from '@/utils/scanCrop';

const GUIDE = guideRect();
const LOCK_THUMB_WIDTH = 48;

/**
 * A loose aiming aid rather than a target. The scanner locates the card itself, so this
 * only has to get the card roughly into view — `locked` reflects when it has, and
 * `leading` shows what the frame currently looks like, well before it is offered.
 */
export function ScanGuideOverlay({
  hint,
  locked = false,
  leading = null,
}: {
  hint: string;
  locked?: boolean;
  leading?: CardListItem | null;
}) {
  const art = leading?.imageUrl ? resolveImageUrl(leading.imageUrl) : '';
  return (
    <View className="absolute inset-0" pointerEvents="none">
      {/* Double border: the feed can be light or dark, so one ring always contrasts. */}
      <View
        className="absolute rounded-[3px] border-2 border-background/60 p-[2px]"
        style={{
          left: `${GUIDE.x * 100}%`,
          top: `${GUIDE.y * 100}%`,
          width: `${GUIDE.width * 100}%`,
          height: `${GUIDE.height * 100}%`,
        }}
      >
        <View
          className={cn(
            'flex-1 rounded-[2px] border-2',
            locked ? 'border-success' : 'border-foreground/80'
          )}
        />
      </View>

      {leading ? (
        <View className="absolute inset-x-0 top-3 items-center">
          <View className="max-w-[80%] flex-row items-center gap-2 rounded-[3px] bg-background/80 px-2 py-1.5">
            <View
              className={cn(
                'h-10 w-7 shrink-0 overflow-hidden border border-border bg-card-panel',
                CARD_ART_RADIUS_CLASS
              )}
            >
              {art ? (
                <CardArtImage
                  uri={art}
                  recyclingKey={leading.variantNumber}
                  className="h-full w-full"
                  contentFit="cover"
                  contentPosition="top"
                  transition={0}
                  priority="low"
                  instant
                  thumbWidth={LOCK_THUMB_WIDTH}
                />
              ) : null}
            </View>
            <Text
              className="min-w-0 shrink text-sm font-semibold text-foreground"
              numberOfLines={1}
            >
              {leading.name}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="absolute inset-x-0 bottom-3 items-center">
        <Text className="rounded-[3px] bg-background/70 px-2 py-1 font-mono text-[11px] text-foreground">
          {hint}
        </Text>
      </View>
    </View>
  );
}
