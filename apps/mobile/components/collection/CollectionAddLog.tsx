import { View } from 'react-native';
import { useState } from 'react';
import {
  RECENT_COLLECTION_ACTIVITY_LIMIT,
  type CollectionActivityEvent,
} from '@riftbound/contracts';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { ChevronDownIcon, ChevronUpIcon, ClockIcon } from '@/components/icons';
import {
  COLLECTION_ADD_LOG_DELTA_CLASS,
  COLLECTION_ADD_LOG_ROW_CLASS,
  COLLECTION_ADD_LOG_TIME_CLASS,
  COLLECTION_ADD_LOG_WHAT_CLASS,
} from '@/constants/operateType';
import { useCollectionShareStatus } from '@/hooks/useCollectionShare';
import { useCollectionActivityHistory } from '@/hooks/useCollectionActivityHistory';
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
  expanded = false,
}: {
  event: CollectionActivityEvent;
  index: number;
  actorName: string | null;
  expanded?: boolean;
}) {
  const added = event.quantityDelta > 0;
  const what = formatCollectionLogWhat(
    event.quantityDelta,
    event.quantityAfter,
    actorName,
    event.isFoil
  );
  if (expanded) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${formatCollectionAddAt(event.at)}. ${what}. ${formatCollectionLogDelta(event.quantityDelta)}`}
        className={cn(
          'flex-row items-center gap-3 py-3',
          index > 0 && 'border-t border-border'
        )}
      >
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-xs tabular-nums text-muted-foreground">
            {formatCollectionAddAt(event.at)}
          </Text>
          <Text className="text-sm leading-5 text-foreground">{what}</Text>
        </View>
        <Text
          className={cn(
            'shrink-0 font-mono text-sm font-semibold tabular-nums',
            added ? 'text-success' : 'text-muted-foreground'
          )}
        >
          {formatCollectionLogDelta(event.quantityDelta)}
        </Text>
      </View>
    );
  }
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

function HistoryFooter({
  history,
  count,
}: {
  history: ReturnType<typeof useCollectionActivityHistory>;
  count: number;
}) {
  if (history.isPending) {
    return (
      <Text
        accessibilityLiveRegion="polite"
        className="py-4 text-sm text-muted-foreground"
      >
        Loading history…
      </Text>
    );
  }
  if (history.isError) {
    return (
      <View className="gap-2 py-3">
        <Text accessibilityRole="alert" className="text-sm text-muted-foreground">
          Couldn’t load collection history. Try again.
        </Text>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 w-auto self-start rounded-[3px]"
          busy={history.isFetching}
          accessibilityLabel="Retry loading collection history"
          onPress={() => {
            if (history.isFetchNextPageError) void history.fetchNextPage();
            else void history.refetch();
          }}
        >
          <ButtonText>Retry</ButtonText>
        </Button>
      </View>
    );
  }
  if (history.hasNextPage) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="mt-2 min-h-11 rounded-[3px] border-border bg-card-panel"
        busy={history.isFetchingNextPage}
        accessibilityLabel="Load older activity"
        onPress={() => {
          void history.fetchNextPage();
        }}
      >
        <ButtonText className="text-xs font-medium text-foreground">
          Load older activity
        </ButtonText>
        <ButtonIcon>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </ButtonIcon>
      </Button>
    );
  }
  return (
    <Text className="border-t border-border py-3 text-center text-xs text-muted-foreground">
      {count === 0
        ? 'No collection activity yet.'
        : 'You’ve reached the start of this card’s history.'}
    </Text>
  );
}

export function CollectionAddLog({
  events,
  variantNumbers,
  className,
}: {
  events: CollectionActivityEvent[] | undefined;
  variantNumbers: readonly string[];
  className?: string;
}) {
  const sessionQuery = authClient.useSession();
  const shareStatus = useCollectionShareStatus();
  const [expanded, setExpanded] = useState(false);
  const history = useCollectionActivityHistory(variantNumbers, expanded);
  const previewRows = (events ?? []).slice(0, RECENT_COLLECTION_ACTIVITY_LIMIT);
  const rows = expanded
    ? (history.data?.pages.flatMap((page) => page.data) ?? [])
    : previewRows;

  const viewerUserId = sessionQuery.data?.user.id;
  const showActor = shareStatus.data?.shared === true;

  if (previewRows.length === 0 && !expanded) return null;

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
    <View className={cn(className)}>
      <View
        className={cn(
          'flex-row flex-wrap items-center justify-between gap-x-3',
          expanded && 'border-b border-border'
        )}
      >
        <View className="flex-row items-center gap-2">
          <ClockIcon className="size-4 text-muted-foreground" />
          <Text className="text-sm font-semibold text-foreground">
            {expanded ? 'Collection history' : 'Recent activity'}
          </Text>
        </View>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 w-auto rounded-[3px] px-2"
          onPress={() => setExpanded((value) => !value)}
          accessibilityState={{ expanded }}
        >
          <ButtonText className="text-xs text-muted-foreground">
            {expanded ? 'Hide history' : 'View history'}
          </ButtonText>
          <ButtonIcon>
            {expanded ? (
              <ChevronUpIcon className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            )}
          </ButtonIcon>
        </Button>
      </View>
      <View
        accessible={!expanded}
        accessibilityRole={expanded ? undefined : 'text'}
        accessibilityLabel={expanded ? undefined : accessibilityLabel(lines)}
      >
        {rows.map((event, index) => {
          const actorName =
            showActor && event.actor.userId !== viewerUserId ? event.actor.name : null;
          return (
            <LogLine
              key={event.id}
              event={event}
              index={index}
              actorName={actorName}
              expanded={expanded}
            />
          );
        })}
      </View>
      {expanded ? <HistoryFooter history={history} count={rows.length} /> : null}
    </View>
  );
}
