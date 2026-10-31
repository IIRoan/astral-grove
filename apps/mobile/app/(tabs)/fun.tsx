import * as Clipboard from 'expo-clipboard';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CardArtHoverPreview } from '@/components/deck/CardArtHoverPreview';
import { DeckCardArt } from '@/components/deck/DeckCardArt';
import { FilterStatChip } from '@/components/filters/FilterPrimitives';
import { ChevronDownIcon } from '@/components/icons';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SmoothChevron, SmoothCollapse } from '@/components/ui/smooth-collapse';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast.api';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { SET_DIRECTORY } from '@/constants/setDirectory';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import { fetchCardDetailsByVariant } from '@/lib/batchCardsIndex';
import { cardHasType, resolveDeckCardImageUrl } from '@/lib/deck-card';
import { exportPiltoverArchive } from '@/lib/deck-io';
import {
  DEFAULT_RANDOMIZER_SETTINGS,
  generateRandomDeck,
  RANDOMIZER_DOMAINS,
  type RandomizerCopies,
  type RandomizerSettings,
} from '@/lib/deck-randomizer';
import { resolveDeckSharePayload } from '@/lib/deck-share';
import type { DeckCard, DeckEntry, DeckState } from '@/lib/deck-types';
import { FORM_COLUMN_CLASS } from '@/lib/responsive-layout';
import { cn } from '@/lib/utils';
import { openCard } from '@/utils/cardNavigation';
import { hapticPress } from '@/utils/haptics';

const COPIES_OPTIONS: { id: RandomizerCopies; label: string }[] = [
  { id: 'singleton', label: 'Singleton' },
  { id: 'random', label: 'Random 1–3' },
  { id: 'playset', label: 'Playsets' },
];

const SET_OPTIONS = SET_DIRECTORY.filter((set) => !set.special);

type ExportFormat = 'code' | 'tts' | 'text';

const EXPORT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: 'code', label: 'Deck code' },
  { id: 'tts', label: 'TTS' },
  { id: 'text', label: 'Text list' },
];

function exportDeck(deck: DeckState, format: ExportFormat): string {
  if (format === 'text') return exportPiltoverArchive(deck);
  const result = resolveDeckSharePayload(deck, format);
  return result.ok ? result.value : result.error;
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

function settingsSummary(settings: RandomizerSettings): string {
  const sets = SET_OPTIONS.filter((set) => settings.sets.includes(set.code));
  return [
    settings.domains.length ? settings.domains.join(', ') : 'Any domain',
    sets.length ? sets.map((set) => set.name).join(', ') : 'All sets',
    COPIES_OPTIONS.find((option) => option.id === settings.copies)?.label,
  ].join(' · ');
}

const NO_FETCHED_ART = new Map<string, string>();

function CardThumb({ card }: { card: DeckCard }) {
  const uri = resolveDeckCardImageUrl(card, NO_FETCHED_ART);
  const thumb = (
    <View
      className={cn(
        'h-[50px] w-9 overflow-hidden border border-border bg-background',
        FACTORY_RADIUS_CONTROL_CLASS
      )}
    >
      {uri ? <DeckCardArt uri={uri} variantNumber={card.variantNumber} /> : null}
    </View>
  );
  if (!uri) return thumb;
  return (
    <CardArtHoverPreview
      imageUri={uri}
      variantNumber={card.variantNumber}
      orientation={cardHasType(card, 'battlefield') ? 'landscape' : 'portrait'}
    >
      {thumb}
    </CardArtHoverPreview>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <SectionLabel className="mb-0">{label}</SectionLabel>
      {children}
    </View>
  );
}

function EntryList({
  title,
  entries,
  twoColumns,
}: {
  title: string;
  entries: DeckEntry[];
  twoColumns: boolean;
}) {
  const router = useRouter();
  return (
    <View className="gap-1">
      <Text className="text-xs font-semibold text-muted-foreground">
        {title} · {entries.reduce((sum, entry) => sum + entry.count, 0)}
      </Text>
      <View className={twoColumns ? 'flex-row flex-wrap gap-y-1' : 'gap-1'}>
        {entries.map((entry) => (
          <Pressable
            key={entry.card.name}
            accessibilityRole="button"
            accessibilityLabel={`View ${entry.card.name}`}
            className={cn(
              'flex-row items-center gap-2 rounded-[3px] active:bg-card-panel',
              twoColumns && 'w-1/2 pr-3'
            )}
            onPress={() => {
              hapticPress();
              openCard(router, entry.card.variantNumber, 'modal');
            }}
          >
            <CardThumb card={entry.card} />
            <Text className="font-mono text-sm text-muted-foreground">
              {entry.count}×
            </Text>
            <Text className="min-w-0 flex-1 text-sm text-foreground" numberOfLines={1}>
              {entry.card.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function FunScreen() {
  const catalogIndex = useCatalogIndex();
  const items = getCatalogIndexItems(catalogIndex.data);
  const [settings, setSettings] = useState<RandomizerSettings>(
    DEFAULT_RANDOMIZER_SETTINGS
  );
  const [format, setFormat] = useState<ExportFormat>('code');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wide = useShowSideRail();

  const generate = useMutation({
    mutationFn: () => generateRandomDeck(items, settings, fetchCardDetailsByVariant),
    meta: { action: 'randomizer.generate' },
  });
  const deck = generate.data;
  const exported = deck ? exportDeck(deck, format) : '';

  const copy = async () => {
    hapticPress();
    if (await Clipboard.setStringAsync(exported)) toast.success('Copied to clipboard');
    else toast.error('Could not copy to clipboard.');
  };

  return (
    <ScreenLayout
      contentClassName={wide ? 'max-w-[1200px] self-center' : FORM_COLUMN_CLASS}
    >
      <ScreenHeader title="Fun" subtitle="Deck randomizer" />
      <Text className="text-sm text-muted-foreground">
        Rolls a random legend, a matching champion, 39 random cards, runes and
        battlefields. Every deck follows Constructed rules.
      </Text>

      <View className={cn('mt-6 gap-6', wide && 'flex-row items-start')}>
        <View className={cn('gap-6', wide && 'w-[380px] shrink-0')}>
          <View className="overflow-hidden rounded-[3px] border border-border bg-card">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              accessibilityState={{ expanded: settingsOpen }}
              onPress={() => {
                hapticPress();
                setSettingsOpen((open) => !open);
              }}
              className="min-h-12 flex-row items-center justify-between gap-3 px-4 py-2 active:bg-card-panel"
            >
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-foreground">Settings</Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {settingsSummary(settings)}
                </Text>
              </View>
              <SmoothChevron open={settingsOpen}>
                <ChevronDownIcon
                  className="size-4 text-muted-foreground"
                  weight="bold"
                />
              </SmoothChevron>
            </Pressable>
            <SmoothCollapse open={settingsOpen}>
              <View className="gap-6 border-t border-border p-4">
                <Section label="Legend domains">
                  <View className="flex-row flex-wrap gap-2">
                    {RANDOMIZER_DOMAINS.map((domain) => (
                      <FilterStatChip
                        key={domain}
                        label={domain}
                        active={settings.domains.includes(domain)}
                        onPress={() =>
                          setSettings((s) => ({
                            ...s,
                            domains: toggle(s.domains, domain),
                          }))
                        }
                      />
                    ))}
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {settings.domains.length
                      ? 'Legend stays inside the selected domains.'
                      : 'Any domain.'}
                  </Text>
                </Section>

                <Section label="Sets">
                  <View className="flex-row flex-wrap gap-2">
                    {SET_OPTIONS.map((set) => (
                      <FilterStatChip
                        key={set.code}
                        label={set.name}
                        active={settings.sets.includes(set.code)}
                        onPress={() =>
                          setSettings((s) => ({ ...s, sets: toggle(s.sets, set.code) }))
                        }
                      />
                    ))}
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {settings.sets.length ? 'Runes come from any set.' : 'All sets.'}
                  </Text>
                </Section>

                <Section label="Copies per card">
                  <View className="flex-row flex-wrap gap-2">
                    {COPIES_OPTIONS.map((option) => (
                      <FilterStatChip
                        key={option.id}
                        label={option.label}
                        active={settings.copies === option.id}
                        onPress={() =>
                          setSettings((s) => ({ ...s, copies: option.id }))
                        }
                      />
                    ))}
                  </View>
                </Section>
              </View>
            </SmoothCollapse>
          </View>

          <Button
            accessibilityLabel={deck ? 'Reroll deck' : 'Generate deck'}
            disabled={items.length === 0 || generate.isPending}
            onPress={() => {
              hapticPress();
              generate.mutate();
            }}
          >
            <ButtonText>
              {items.length === 0
                ? 'Loading cards…'
                : generate.isPending
                  ? 'Rolling…'
                  : deck
                    ? 'Reroll'
                    : 'Generate deck'}
            </ButtonText>
          </Button>

          {generate.error ? (
            <Text className="text-sm text-destructive">{generate.error.message}</Text>
          ) : null}

          {deck ? (
            <Section label="Export">
              <View className="flex-row flex-wrap gap-2">
                {EXPORT_OPTIONS.map((option) => (
                  <FilterStatChip
                    key={option.id}
                    label={option.label}
                    active={format === option.id}
                    onPress={() => setFormat(option.id)}
                  />
                ))}
              </View>
              <View className="rounded-[3px] border border-border bg-card p-3">
                <Text
                  testID="randomizer-export"
                  className="font-mono text-xs leading-5 text-foreground"
                  selectable
                >
                  {exported}
                </Text>
              </View>
              <Button variant="outline" accessibilityLabel="Copy export" onPress={copy}>
                <ButtonText>Copy</ButtonText>
              </Button>
            </Section>
          ) : null}
        </View>

        {deck || wide ? (
          <View className={cn(wide && 'min-w-0 flex-1')}>
            <Section label="Your deck">
              {deck ? (
                <View className="gap-4 rounded-[3px] border border-border bg-card p-3">
                  <EntryList
                    title="Legend & champion"
                    twoColumns={wide}
                    entries={[deck.legend, deck.champion].flatMap((card) =>
                      card ? [{ card, count: 1 }] : []
                    )}
                  />
                  <EntryList
                    title="Main deck"
                    twoColumns={wide}
                    entries={[...deck.mainDeck.values()]}
                  />
                  <EntryList
                    title="Runes"
                    twoColumns={wide}
                    entries={[...deck.runes.values()]}
                  />
                  <EntryList
                    title="Battlefields"
                    twoColumns={wide}
                    entries={[...deck.battlefields.values()]}
                  />
                </View>
              ) : (
                <View className="min-h-[320px] items-center justify-center rounded-[3px] border border-dashed border-border p-6">
                  <Text className="text-sm text-muted-foreground">
                    Generate a deck to see it here.
                  </Text>
                </View>
              )}
            </Section>
          </View>
        ) : null}
      </View>
    </ScreenLayout>
  );
}
