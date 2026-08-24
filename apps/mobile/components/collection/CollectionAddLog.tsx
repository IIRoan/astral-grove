import { View } from 'react-native';
import {
  RECENT_COLLECTION_ACTIVITY_LIMIT,
  type CollectionActivityEvent,
} from '@riftbound/contracts';
import { Text } from '@/components/ui/text';
import {
  COLLECTION_ADD_LOG_DELTA_CLASS,
  COLLECTION_ADD_LOG_ROW_CLASS,
  COLLECTION_ADD_LOG_TIME_CLASS,
  COLLECTION_ADD_LOG_WHAT_CLASS,
} from '@/constants/operateType';
import { useCollectionShareStatus } from '@/hooks/useCollectionShare';
import {
  formatCollectionAddAt,
  formatCollectionLogDelta,
  formatCollectionLogWhat,
} from '@/lib/collection-add-log';
import { cn } from '@/lib/utils';
import { authClient } from '@/src/lib/auth-client';

function accessibilityLabel(lines: string[]): string {
  if (lines.length === 1) return lines[0] ?? 'Collection log';
  return `Collection log. ${lines.join('. ')}`;
}

function LogLine({
  event,
  index,
  actorName,
}: {
  event: CollectionActivityEvent;
  index: number;
  actorName: string | null;
}) {
  const added = event.quantityDelta > 0;
  return (
    <View
      className={cn(
        COLLECTION_ADD_LOG_ROW_CLASS,
        index > 0 && 'border-t border-border/60'
      )}
    >
      <Text className={COLLECTION_ADD_LOG_TIME_CLASS}>
        {formatCollectionAddAt(event.at)}
      </Text>
      <Text className={COLLECTION_ADD_LOG_WHAT_CLASS} numberOfLines={1}>
        {formatCollectionLogWhat(
          event.quantityDelta,
          event.quantityAfter,
          actorName,
          event.isFoil
        )}
      </Text>
      <View className="w-7 shrink-0 items-end">
        <Text
          className={cn(
            COLLECTION_ADD_LOG_DELTA_CLASS,
            added ? 'text-success' : 'text-muted-foreground'
          )}
        >
          {formatCollectionLogDelta(event.quantityDelta)}
        </Text>
      </View>
    </View>
  );
}

export function CollectionAddLog({
  events,
  className,
}: {
  events: CollectionActivityEvent[] | undefined;
  className?: string;
}) {
  const sessionQuery = authClient.useSession();
  const shareStatus = useCollectionShareStatus();
  const rows = (events ?? []).slice(0, RECENT_COLLECTION_ACTIVITY_LIMIT);

  const viewerUserId = sessionQuery.data?.user.id;
  const showActor = shareStatus.data?.shared === true;

  if (rows.length === 0) return null;

  const lines = rows.map((event) => {
    const actorName =
      showActor && event.actor.userId !== viewerUserId ? event.actor.name : null;
    return `${formatCollectionAddAt(event.at)} ${formatCollectionLogWhat(
      event.quantityDelta,
      event.quantityAfter,
      actorName,
      event.isFoil
    )} ${formatCollectionLogDelta(event.quantityDelta)}`;
  });

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel(lines)}
      className={cn(className)}
    >
      {rows.map((event, index) => {
        const actorName =
          showActor && event.actor.userId !== viewerUserId ? event.actor.name : null;
        return (
          <LogLine key={event.id} event={event} index={index} actorName={actorName} />
        );
      })}
    </View>
  );
}
