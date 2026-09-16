import { View } from 'react-native';
import type { CollectionImportPreviewResponse } from '@riftbound/contracts';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';

export type ImportPreviewData = CollectionImportPreviewResponse['data'];

const PREVIEW_THUMB_WIDTH = 48;

function formatQtyChange(change: ImportPreviewData['changes'][number]): string {
  if (change.status === 'new') {
    return `0 → ${String(change.quantityAfter)}`;
  }
  return `${String(change.quantityBefore)} → ${String(change.quantityAfter)}`;
}

function statusLabel(status: ImportPreviewData['changes'][number]['status']): string {
  switch (status) {
    case 'new':
      return 'New';
    case 'increase':
      return 'Add';
    case 'decrease':
      return 'Reduce';
    case 'unchanged':
      return 'Same';
  }
}

/** Staged review shared by the TTS paste sheet and the camera scanner. */
export function ImportPreviewBody({
  preview,
  totalLabel = 'total cards in the paste',
}: {
  preview: ImportPreviewData;
  totalLabel?: string;
}) {
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-sm leading-snug text-muted-foreground">
          Adding {preview.totalCopies.toLocaleString()} copies across{' '}
          {preview.uniquePrintings.toLocaleString()} printings
          {preview.unresolvedCount > 0
            ? ` · ${preview.unresolvedCount.toLocaleString()} could not be matched`
            : ''}
          .
        </Text>
        <Text className="font-mono text-[11px] text-muted-foreground">
          {preview.newCount.toLocaleString()} new printings ·{' '}
          {preview.increasedCount.toLocaleString()} already owned ·{' '}
          {preview.totalTokens.toLocaleString()} {totalLabel}
        </Text>
      </View>

      {preview.changes.length > 0 ? (
        <View className="overflow-hidden rounded-[3px] border border-border">
          {preview.changes.map((change, index) => (
            <View
              key={change.variantNumber}
              className={cn(
                'flex-row items-center gap-3 px-3 py-2',
                index > 0 && 'border-t border-border'
              )}
            >
              <PreviewThumb change={change} />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {change.name ?? change.variantNumber}
                </Text>
                <Text className="font-mono text-[11px] text-muted-foreground">
                  {change.setCode ? `${change.setCode} · ` : ''}
                  {change.variantNumber}
                </Text>
              </View>
              <View className="items-end gap-0.5">
                <Text className="font-mono text-[12px] tabular-nums text-foreground">
                  {formatQtyChange(change)}
                </Text>
                <Text className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {statusLabel(change.status)} · +{String(change.quantityDelta)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {preview.unresolved.length > 0 ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Unresolved</Text>
          {preview.unresolved.map((row) => (
            <Text
              key={`${row.token}-${row.message}`}
              className="font-mono text-[11px] leading-relaxed text-destructive"
            >
              {row.token}: {row.message}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PreviewThumb({ change }: { change: ImportPreviewData['changes'][number] }) {
  const uri = change.imageUrl ? resolveImageUrl(change.imageUrl) : '';
  return (
    <View
      className={cn(
        'h-14 w-10 shrink-0 overflow-hidden border border-border bg-card-panel',
        CARD_ART_RADIUS_CLASS
      )}
    >
      {uri ? (
        <CardArtImage
          uri={uri}
          recyclingKey={change.variantNumber}
          className="h-full w-full"
          contentFit="cover"
          contentPosition="top"
          transition={0}
          priority="low"
          instant
          thumbWidth={PREVIEW_THUMB_WIDTH}
        />
      ) : null}
    </View>
  );
}
