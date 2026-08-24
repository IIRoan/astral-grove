import { View } from 'react-native';
import { StatusKeywordBadge } from '@/components/riftbound/RiftboundBadges';
import { cn } from '@/lib/utils';

export function CardBannedOverlay({
  compact = true,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <View pointerEvents="none" className={cn('absolute left-1 top-1 z-10', className)}>
      <StatusKeywordBadge status="illegal" compact={compact} />
    </View>
  );
}
