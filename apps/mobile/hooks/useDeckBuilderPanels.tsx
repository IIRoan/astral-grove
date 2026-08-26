import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeckBuilderInfoDrawer } from '@/components/deck/DeckBuilderInfoDrawer';
import { DeckCompositionList } from '@/components/deck/DeckCompositionList';
import { DeckBuilderCatalogPanel } from '@/components/deck/DeckBuilderCatalogPanel';
import { DeckDescriptionPanel } from '@/components/deck/DeckDescription';
import { DeckShowcasePanel } from '@/components/deck/DeckShowcasePanel';
import { DeckStatsPanel } from '@/components/deck/DeckStatsPanel';
import type { DeckBuilderMiddlePanel } from '@/components/deck/DeckBuilderMiddlePanelToggle';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import { useCollectionByCardName } from '@/hooks/useDeckCardResolver';
import { useDeckCardImages } from '@/hooks/useDeckCardImages';
import {
  changeDeckCardQty,
  deckVariantNumbersKey,
  removeDeckCard,
} from '@/lib/deck-card';
import { adjustRuneCountForDomain } from '@/lib/deck-runes';
import type { DeckSectionKey, DeckCard, DeckState } from '@/lib/deck-types';
import { prefetchDeckAddCatalog } from '@/lib/prefetchDeckAddCatalog';
import { catalogPowerByCard, computeDeckStats } from '@/lib/deck-stats';
import { hapticPress } from '@/utils/haptics';

const EMPTY_IMAGE_MAP = new Map<string, string>();

type CatalogSection = 'mainDeck' | 'sideboard';

interface UseDeckBuilderPanelsOptions {
  deck: DeckState;
  readOnly: boolean;
  collection: ReturnType<typeof import('@/hooks/useCollection').useCollection>['data'];
  paddingBottomInline: number;
  catalogSection: CatalogSection;
  onSectionChange: (section: CatalogSection) => void;
  middlePanel: DeckBuilderMiddlePanel;
  onMiddlePanelChange: (panel: DeckBuilderMiddlePanel) => void;
  onPersist: (
    deck: DeckState | ((previous: DeckState) => DeckState),
    options?: { immediate?: boolean }
  ) => void;
  onChangeLegend: () => void;
  onDescriptionChange: (description: string) => void;
  setMobilePanel: (panel: 'info' | 'list' | null) => void;
  setInfoDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  runeCardsByDomain: ReadonlyMap<string, DeckCard>;
  runeCardsLoading: boolean;
}

export function useDeckBuilderPanels({
  deck,
  readOnly,
  collection,
  paddingBottomInline,
  catalogSection,
  onSectionChange,
  middlePanel,
  onMiddlePanelChange,
  onPersist,
  onChangeLegend,
  onDescriptionChange,
  setMobilePanel,
  setInfoDrawerOpen,
  runeCardsByDomain,
  runeCardsLoading,
}: UseDeckBuilderPanelsOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useMobileLayout();
  const insets = useSafeAreaInsets();
  const catalogIndex = useCatalogIndex();
  const catalogPower = useMemo(
    () => catalogPowerByCard(getCatalogIndexItems(catalogIndex.data)),
    [catalogIndex.data]
  );
  const stats = useMemo(
    () => computeDeckStats(deck, catalogPower),
    [deck, catalogPower]
  );
  const collectionByName = useCollectionByCardName(collection);
  const variantKey = deckVariantNumbersKey(deck);
  const { data: imageByVariant } = useDeckCardImages(variantKey);
  const images = useMemo(() => imageByVariant ?? EMPTY_IMAGE_MAP, [imageByVariant]);
  const sheetPaddingBottom = Math.max(insets.bottom, 16) + 24;

  const focusCatalogSection = useCallback(
    (section: CatalogSection) => {
      hapticPress();
      onMiddlePanelChange('catalog');
      onSectionChange(section);
      setMobilePanel(null);
    },
    [onMiddlePanelChange, onSectionChange, setMobilePanel]
  );

  const openSpecialAdd = useCallback(
    (section: DeckSectionKey) => {
      if (readOnly) return;
      if (section === 'mainDeck' || section === 'sideboard') {
        focusCatalogSection(section);
        return;
      }
      if (section === 'runes') {
        if (isMobile) setMobilePanel('info');
        else setInfoDrawerOpen(true);
        return;
      }
      hapticPress();
      setMobilePanel(null);
      void prefetchDeckAddCatalog(queryClient, deck, section);
      router.push(`/decks/${deck.id}/add?section=${section}`);
    },
    [
      deck,
      focusCatalogSection,
      isMobile,
      queryClient,
      readOnly,
      router,
      setInfoDrawerOpen,
      setMobilePanel,
    ]
  );

  const closeStats = useCallback(() => {
    onMiddlePanelChange('catalog');
    setMobilePanel(null);
  }, [onMiddlePanelChange, setMobilePanel]);

  const toggleStats = useCallback(() => {
    onMiddlePanelChange(middlePanel === 'stats' ? 'catalog' : 'stats');
    setMobilePanel(null);
  }, [middlePanel, onMiddlePanelChange, setMobilePanel]);

  const handleAdjustRune = useCallback(
    (domain: string, delta: number) => {
      if (readOnly) return;
      const runeCard = runeCardsByDomain.get(domain) ?? null;
      onPersist(adjustRuneCountForDomain(deck, domain, delta, runeCard));
    },
    [deck, onPersist, readOnly, runeCardsByDomain]
  );

  const infoDrawer = useMemo(
    () => (
      <DeckBuilderInfoDrawer
        deck={deck}
        readOnly={readOnly}
        imageByVariant={images}
        collectionByName={collectionByName}
        runeCardsByDomain={runeCardsByDomain}
        runeCardsLoading={runeCardsLoading}
        onChangeLegend={onChangeLegend}
        onRemoveLegend={
          deck.format === 'pre-rift'
            ? () =>
                onPersist((prev) => removeDeckCard(prev, 'legend'), { immediate: true })
            : undefined
        }
        onAddChampion={() => openSpecialAdd('champion')}
        onRemoveChampion={() => onPersist(removeDeckCard(deck, 'champion'))}
        onAdjustRune={handleAdjustRune}
        onAddBattlefield={() => openSpecialAdd('battlefields')}
        onRemoveBattlefield={(name) =>
          onPersist((prev) => removeDeckCard(prev, 'battlefields', name), {
            immediate: true,
          })
        }
        onAdjustBattlefield={(name, delta) =>
          onPersist((prev) => changeDeckCardQty(prev, 'battlefields', name, delta), {
            immediate: true,
          })
        }
        middlePanel={readOnly ? undefined : middlePanel}
        onMiddlePanelChange={readOnly ? undefined : onMiddlePanelChange}
        paddingBottom={paddingBottomInline}
        scrollEnabled={!isMobile}
      />
    ),
    [
      deck,
      readOnly,
      images,
      collectionByName,
      runeCardsByDomain,
      runeCardsLoading,
      onChangeLegend,
      openSpecialAdd,
      handleAdjustRune,
      middlePanel,
      onMiddlePanelChange,
      paddingBottomInline,
      isMobile,
      onPersist,
    ]
  );

  const descriptionPanel = useMemo(
    () => (
      <DeckDescriptionPanel
        value={deck.description}
        onChange={onDescriptionChange}
        paddingBottom={paddingBottomInline}
      />
    ),
    [deck.description, onDescriptionChange, paddingBottomInline]
  );

  const compositionList = useMemo(
    () => (
      <DeckCompositionList
        deck={deck}
        readOnly={readOnly}
        imageByVariant={images}
        collectionByName={collectionByName}
        openSource={readOnly ? 'deck-view' : undefined}
        onMinus={(section, name) =>
          onPersist((prev) => changeDeckCardQty(prev, section, name, -1), {
            immediate: true,
          })
        }
        onPlus={(section, name) =>
          onPersist((prev) => changeDeckCardQty(prev, section, name, 1), {
            immediate: true,
          })
        }
        onRemove={(section, name) => {
          if (section === 'legend') {
            if (deck.format === 'pre-rift') {
              onPersist((prev) => removeDeckCard(prev, 'legend'), { immediate: true });
            } else {
              onChangeLegend();
            }
            return;
          }
          onPersist((prev) => removeDeckCard(prev, section, name), { immediate: true });
        }}
        onAddSection={(section) => openSpecialAdd(section)}
        onSectionPress={(section) => openSpecialAdd(section)}
        stats={stats}
        statsOpen={middlePanel === 'stats'}
        onToggleStats={toggleStats}
        paddingBottom={isMobile ? sheetPaddingBottom : paddingBottomInline}
        bordered={false}
      />
    ),
    [
      deck,
      readOnly,
      images,
      collectionByName,
      onPersist,
      onChangeLegend,
      openSpecialAdd,
      stats,
      middlePanel,
      toggleStats,
      isMobile,
      sheetPaddingBottom,
      paddingBottomInline,
    ]
  );

  const catalogPanel = useMemo(
    () => (
      <DeckBuilderCatalogPanel
        deck={deck}
        readOnly={false}
        collectionByName={collectionByName}
        onPersist={onPersist}
        section={catalogSection}
        onSectionChange={onSectionChange}
        paddingBottom={paddingBottomInline}
      />
    ),
    [
      deck,
      collectionByName,
      onPersist,
      catalogSection,
      onSectionChange,
      paddingBottomInline,
    ]
  );

  const showcasePanel = useMemo(
    () => (
      <DeckShowcasePanel
        deck={deck}
        imageByVariant={images}
        collectionByName={collectionByName}
        runeCardsByDomain={runeCardsByDomain}
        paddingBottom={paddingBottomInline}
      />
    ),
    [deck, images, collectionByName, runeCardsByDomain, paddingBottomInline]
  );

  const statsPanel = useMemo(
    () => (
      <DeckStatsPanel
        stats={stats}
        paddingBottom={paddingBottomInline}
        onClose={closeStats}
        closeLabel={readOnly ? 'Deck' : 'Cards'}
      />
    ),
    [stats, paddingBottomInline, closeStats, readOnly]
  );

  return {
    sheetPaddingBottom,
    focusCatalogSection,
    infoDrawer,
    descriptionPanel,
    compositionList,
    catalogPanel,
    showcasePanel,
    statsPanel,
  };
}
