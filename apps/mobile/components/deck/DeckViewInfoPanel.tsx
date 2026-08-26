import { Pressable, View } from 'react-native';
import { DeckLegalityBadge } from '@/components/deck/DeckLegalityBadge';
import { DeckFormatBadge } from '@/components/deck/DeckFormatBadge';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { deckArchiveViewUrl, deckBrowseSummaryLine } from '@/lib/deck-browse';
import { openExternalUrl } from '@/lib/open-external';
import { collectIllegalCardNames, deckHasBannedCards } from '@/lib/card-legality';
import { deckListStatus } from '@/lib/deck-list-status';
import type { DeckState } from '@/lib/deck-types';
import {
  ThemedIcon,
  BookOpenIcon,
  GitCompareIcon,
  VideoIcon,
} from '@/components/icons';

interface DeckViewInfoPanelProps {
  deck: DeckState;
}

export function DeckViewInfoPanel({ deck }: DeckViewInfoPanelProps) {
  const summary = deckBrowseSummaryLine(deck);
  const archiveUrl = deckArchiveViewUrl(deck.id);
  const illegalNames = collectIllegalCardNames(deck);
  const hasBannedCards = deckHasBannedCards(deck);
  const status = deckListStatus(deck, new Map(), false);
  const tournamentLegal = status.tone !== 'illegal';

  return (
    <View className="gap-3">
      <DeckFormatBadge format={deck.format} />

      <View className="gap-2">
        <DeckLegalityBadge isLegal={tournamentLegal} />
        {hasBannedCards ? (
          <Text className="text-[12px] leading-5 text-muted-foreground">
            Illegal cards: {illegalNames.join(', ')}
          </Text>
        ) : status.tone !== 'complete' ? (
          <Text className="text-[12px] leading-5 text-muted-foreground">
            {status.caption}
          </Text>
        ) : null}
      </View>

      {summary ? (
        <Text className="text-[13px] text-muted-foreground">{summary}</Text>
      ) : null}

      {deck.videoUrl || deck.hasGuide || deck.hasMatchups ? (
        <View className="flex-row flex-wrap gap-2">
          {deck.videoUrl ? (
            <Button
              variant="outline"
              size="sm"
              className="w-auto"
              onPress={() => void openExternalUrl(deck.videoUrl!)}
            >
              <ButtonIcon>
                <ThemedIcon icon={VideoIcon} size={14} color="foreground" />
              </ButtonIcon>
              <ButtonText>Watch video</ButtonText>
            </Button>
          ) : null}
          {deck.hasGuide ? (
            <Button
              variant="outline"
              size="sm"
              className="w-auto"
              onPress={() => void openExternalUrl(archiveUrl)}
            >
              <ButtonIcon>
                <ThemedIcon icon={BookOpenIcon} size={14} color="foreground" />
              </ButtonIcon>
              <ButtonText>Read guide</ButtonText>
            </Button>
          ) : null}
          {deck.hasMatchups ? (
            <Button
              variant="outline"
              size="sm"
              className="w-auto"
              onPress={() => void openExternalUrl(archiveUrl)}
            >
              <ButtonIcon>
                <ThemedIcon icon={GitCompareIcon} size={14} color="foreground" />
              </ButtonIcon>
              <ButtonText>View matchups</ButtonText>
            </Button>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="link"
        className="self-start active:opacity-80"
        onPress={() => void openExternalUrl(archiveUrl)}
      >
        <Text className="text-[12px] font-medium text-foreground">
          Open on Piltover Archive
        </Text>
      </Pressable>
    </View>
  );
}
