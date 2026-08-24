import { StatusKeywordBadge } from '@/components/riftbound/RiftboundBadges';

interface DeckLegalityBadgeProps {
  isLegal: boolean;
  compact?: boolean;
}

export function DeckLegalityBadge({
  isLegal,
  compact = false,
}: DeckLegalityBadgeProps) {
  return (
    <StatusKeywordBadge status={isLegal ? 'legal' : 'illegal'} compact={compact} />
  );
}
