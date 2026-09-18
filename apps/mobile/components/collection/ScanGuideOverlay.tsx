import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { guideRect } from '@/utils/scanCrop';

const GUIDE = guideRect();

/**
 * A loose aiming aid rather than a target. The frame engine locates the card itself, so
 * this only has to get the card roughly into view — `locked` reflects when it has.
 */
export function ScanGuideOverlay({
  hint,
  locked = false,
}: {
  hint: string;
  locked?: boolean;
}) {
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

      <View className="absolute inset-x-0 bottom-3 items-center">
        <Text className="rounded-[3px] bg-background/70 px-2 py-1 font-mono text-[11px] text-foreground">
          {hint}
        </Text>
      </View>
    </View>
  );
}
