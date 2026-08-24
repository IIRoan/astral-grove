import { ThemedIcon, CircleIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { domainIconFor } from '@/constants/gameAssets';
import {
  countRunesForDomain,
  getDeckRuneDomains,
  totalRuneCount,
} from '@/lib/deck-builder';
import { DOMAIN_KEYWORD_NAMES } from '@/lib/card-keywords';
import type { DeckCard, DeckState } from '@/lib/deck-types';
import { hapticPress } from '@/utils/haptics';
import { cn } from '@/lib/utils';

interface DeckRunePanelProps {
  deck: DeckState;
  readOnly?: boolean;
  runeCardsByDomain: ReadonlyMap<string, DeckCard>;
  runeCardsLoading?: boolean;
  onAdjust: (domain: string, delta: number) => void;
  dense?: boolean;
  compact?: boolean;
}

function RuneDomainRow({
  domain,
  count,
  readOnly,
  dense,
  onAdjust,
}: {
  domain: string;
  count: number;
  readOnly?: boolean;
  dense?: boolean;
  onAdjust: (delta: number) => void;
}) {
  const icon = domainIconFor(domain);
  const iconSize = dense ? 22 : 28;

  return (
    <View
      className={cn(
        'min-w-0 flex-row items-center rounded-[3px] border border-border bg-card-panel',
        dense ? 'gap-2 px-2 py-1.5' : 'gap-3 px-3 py-3'
      )}
    >
      {icon ? (
        <Image
          source={icon}
          style={{ width: iconSize, height: iconSize }}
          contentFit="contain"
          className="shrink-0"
        />
      ) : (
        <View
          className={cn(
            'shrink-0 items-center justify-center rounded-[3px] bg-background',
            dense ? 'size-5.5' : 'size-7'
          )}
          style={dense ? { width: 22, height: 22 } : undefined}
        >
          <ThemedIcon
            icon={CircleIcon}
            size={dense ? 10 : 12}
            color="muted-foreground"
          />
        </View>
      )}

      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-normal text-foreground" numberOfLines={1}>
          {domain}
        </Text>
        {!dense ? (
          <Text className="font-mono text-[11px] text-muted-foreground">
            {count} rune{count === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      <View
        className={cn(
          'shrink-0 flex-row items-center border border-border bg-background',
          dense ? 'h-7' : 'h-8',
          'rounded-[3px]'
        )}
      >
        {readOnly ? (
          <Text className="px-2.5 text-center font-mono text-sm font-normal tabular-nums text-foreground">
            {count}
          </Text>
        ) : (
          <>
            <Pressable
              accessibilityLabel={`Remove ${domain} rune`}
              className={cn(
                'items-center justify-center active:bg-foreground/10',
                dense ? 'size-7' : 'size-8'
              )}
              onPress={() => {
                hapticPress();
                onAdjust(-1);
              }}
            >
              <ThemedIcon icon={MinusIcon} size={dense ? 12 : 14} color="foreground" />
            </Pressable>
            <Text className="min-w-5 text-center font-mono text-[13px] font-normal tabular-nums text-foreground">
              {count}
            </Text>
            <Pressable
              accessibilityLabel={`Add ${domain} rune`}
              className={cn(
                'items-center justify-center active:bg-foreground/10',
                dense ? 'size-7' : 'size-8'
              )}
              onPress={() => {
                hapticPress();
                onAdjust(1);
              }}
            >
              <ThemedIcon icon={PlusIcon} size={dense ? 12 : 14} color="foreground" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export function DeckRunePanel({
  deck,
  readOnly = false,
  runeCardsByDomain,
  runeCardsLoading = false,
  onAdjust,
  dense = false,
  compact,
}: DeckRunePanelProps) {
  const activeDomains = getDeckRuneDomains(deck);
  const total = totalRuneCount(deck.runes);
  const target = 12;
  const complete = total === target;
  const useDense = dense || compact === true;
  const isPreRift = deck.format === 'pre-rift';

  const displayDomains = isPreRift
    ? [
        ...new Set([
          ...activeDomains,
          ...DOMAIN_KEYWORD_NAMES,
          ...runeCardsByDomain.keys(),
        ]),
      ].sort((a, b) => a.localeCompare(b))
    : activeDomains;

  if (!isPreRift && !deck.legend) return null;

  const domainCountWithRunes = displayDomains.filter(
    (domain) => countRunesForDomain(deck.runes, domain) > 0
  ).length;

  const runeCatalogReady = runeCardsByDomain.size > 0;

  return (
    <View className={cn('w-full min-w-0 gap-2', compact ? 'flex-1' : undefined)}>
      <View className="w-full min-w-0 flex-row items-center justify-between gap-2">
        <Text
          className="min-w-0 flex-1 shrink text-[13px] font-normal text-foreground"
          numberOfLines={1}
        >
          Rune deck
        </Text>
        <Text
          className={cn(
            'shrink-0 font-mono text-[12px] font-normal tabular-nums',
            complete ? 'text-success' : 'text-warning'
          )}
        >
          {total}/{target}
        </Text>
      </View>

      {displayDomains.length > 0 ? (
        <View className="min-w-0 gap-1.5">
          {displayDomains.map((domain) => {
            const count = countRunesForDomain(deck.runes, domain);
            const domainLocked = !runeCatalogReady || !runeCardsByDomain.has(domain);
            return (
              <RuneDomainRow
                key={domain}
                domain={domain}
                count={count}
                readOnly={readOnly || domainLocked}
                dense={useDense}
                onAdjust={(delta) => {
                  onAdjust(domain, delta);
                }}
              />
            );
          })}
        </View>
      ) : (
        <Text className="text-[11px] leading-4 text-muted-foreground">
          Choose a Legend to set rune domains.
        </Text>
      )}

      {isPreRift ? (
        <Text className="font-mono text-[11px] text-muted-foreground">
          {domainCountWithRunes}/3 domains with runes
        </Text>
      ) : null}

      {runeCardsLoading ? (
        <Text className="text-[11px] text-muted-foreground">Loading rune cards…</Text>
      ) : !runeCatalogReady && isPreRift ? (
        <Text className="text-[11px] text-muted-foreground">
          Could not load rune cards from catalog.
        </Text>
      ) : null}
    </View>
  );
}
