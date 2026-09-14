import { InboxIcon, LayersIcon } from '@/components/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { DECK_INFO_DRAWER_WIDTH } from '@/components/deck/DeckBuilderInfoDrawer';
import { DECK_COMPOSITION_LIST_WIDTH } from '@/components/deck/DeckCompositionList';
import { DeckBuilderImportedBanner } from '@/components/deck/DeckBuilderImportedBanner';
import { DeckBuilderMobileSheet } from '@/components/deck/DeckBuilderMobileSheet';
import { DeckBuilderWorkspace } from '@/components/deck/DeckBuilderWorkspace';
import { DeckImportExportSheet } from '@/components/deck/DeckImportExportSheet';
import { DeckBuilderToolbar } from '@/components/deck/DeckBuilderToolbar';
import type { DeckBuilderMiddlePanel } from '@/components/deck/DeckBuilderMiddlePanelToggle';
import { useScreenLayout } from '@/components/shell/ScreenLayout';
import { Layout } from '@/constants/Layout';
import { useLatestRef } from '@/hooks/useLatestRef';
import type { PillNavItem } from '@/components/shell/FloatingPillNav';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useCollection } from '@/hooks/useCollection';
import { useDeckRuneCards } from '@/hooks/useLegendRuneCards';
import { useDeckBuilderPanels } from '@/hooks/useDeckBuilderPanels';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { deckBuilderInfoDrawerFits } from '@/lib/responsive-layout';
import { deckSectionProgress } from '@/lib/deck-display';
import { seedDefaultRuneSplit } from '@/lib/deck-runes';
import type { DeckCard, DeckState } from '@/lib/deck-types';
import { validateDeck } from '@/lib/deck-validation';
import { hapticPress } from '@/utils/haptics';

type IoMode = 'import';
type MobilePanel = 'info' | 'list' | null;
type CatalogSection = 'mainDeck' | 'sideboard';

const EMPTY_RUNE_CARDS_BY_DOMAIN = new Map<string, DeckCard>();

const WORKSPACE_SIZES = {
  drawerWidth: DECK_INFO_DRAWER_WIDTH,
  listWidth: DECK_COMPOSITION_LIST_WIDTH,
  gap: Layout.gridGap,
};

interface DeckBuilderCanvasProps {
  deck: DeckState;
  permanentReadOnly?: boolean;
  editing?: boolean;
  ioMode: IoMode | null;
  onPersist: (
    deck: DeckState | ((previous: DeckState) => DeckState),
    options?: { immediate?: boolean }
  ) => void;
  onIoModeChange: (mode: IoMode | null) => void;
  onChangeLegend: () => void;
  onBack: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  duplicateBusy?: boolean;
  onImportToMyDecks?: () => void;
  importBusy?: boolean;
}

export function DeckBuilderCanvas({
  deck,
  permanentReadOnly = false,
  editing = false,
  ioMode,
  onPersist,
  onIoModeChange,
  onChangeLegend,
  onBack,
  onEdit,
  onDuplicate,
  onDelete,
  duplicateBusy = false,
  onImportToMyDecks,
  importBusy = false,
}: DeckBuilderCanvasProps) {
  const isMobile = useMobileLayout();
  const reduceMotion = useReduceMotion();
  const { paddingBottomInline, contentWidth } = useScreenLayout();
  const readOnly = permanentReadOnly || !editing;
  const [validationExpanded, setValidationExpanded] = useState(false);
  const infoDrawerFits = deckBuilderInfoDrawerFits(contentWidth, WORKSPACE_SIZES);
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(infoDrawerFits);
  const infoDrawerFitsRef = useRef(infoDrawerFits);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [middlePanel, setMiddlePanel] = useState<DeckBuilderMiddlePanel>('catalog');
  const [catalogSection, setCatalogSection] = useState<CatalogSection>('mainDeck');

  const { data: collection = [] } = useCollection();
  const validation = useMemo(() => validateDeck(deck), [deck]);

  const { data: runeCards, isPending: runeCardsLoading } = useDeckRuneCards(deck);
  const runeCardsByDomain = useMemo(
    () => runeCards?.byDomain ?? EMPTY_RUNE_CARDS_BY_DOMAIN,
    [runeCards?.byDomain]
  );
  const seededRunesForLegendRef = useRef<string | null>(null);
  const onPersistRef = useLatestRef(onPersist);

  const runeSeedKey =
    !readOnly &&
    deck.format !== 'pre-rift' &&
    deck.legend != null &&
    deck.runes.size === 0 &&
    runeCardsByDomain.size > 0
      ? `${deck.id}:${deck.legend.variantNumber}`
      : null;

  const seededDeck = useMemo(() => {
    if (!runeSeedKey) return null;
    const seeded = seedDefaultRuneSplit(deck, runeCardsByDomain);
    return seeded.runes.size > 0 ? seeded : null;
  }, [deck, runeCardsByDomain, runeSeedKey]);

  useEffect(() => {
    if (!seededDeck || !runeSeedKey) return;
    if (seededRunesForLegendRef.current === runeSeedKey) return;
    seededRunesForLegendRef.current = runeSeedKey;
    onPersistRef.current(seededDeck);
  }, [runeSeedKey, seededDeck, onPersistRef]);

  useEffect(() => {
    // Auto-close only when the window shrinks past the threshold; a manual open at narrow widths sticks.
    if (infoDrawerFitsRef.current && !infoDrawerFits) setInfoDrawerOpen(false);
    infoDrawerFitsRef.current = infoDrawerFits;
  }, [infoDrawerFits]);

  const handleMiddlePanelChange = useCallback((panel: DeckBuilderMiddlePanel) => {
    setMiddlePanel(panel);
    if (panel !== 'catalog') {
      setMobilePanel(null);
    }
  }, []);

  const handleDescriptionChange = useCallback(
    (description: string) => {
      onPersist((prev) => ({ ...prev, description, updatedAt: Date.now() }));
    },
    [onPersist]
  );

  const {
    sheetPaddingBottom,
    focusCatalogSection,
    infoDrawer,
    descriptionPanel,
    compositionList,
    catalogPanel,
    showcasePanel,
    statsPanel,
  } = useDeckBuilderPanels({
    deck,
    readOnly,
    collection,
    paddingBottomInline,
    catalogSection,
    onSectionChange: setCatalogSection,
    middlePanel,
    onMiddlePanelChange: handleMiddlePanelChange,
    onPersist,
    onChangeLegend,
    onDescriptionChange: handleDescriptionChange,
    setMobilePanel,
    setInfoDrawerOpen,
    runeCardsByDomain,
    runeCardsLoading,
  });

  const handleBack = useCallback(() => {
    hapticPress();
    onBack();
  }, [onBack]);

  const browseSectionNavItems = useMemo((): readonly PillNavItem<CatalogSection>[] => {
    const main = deckSectionProgress(deck, 'mainDeck');
    const side = deckSectionProgress(deck, 'sideboard');
    return [
      {
        id: 'mainDeck',
        label: 'Main',
        accessibilityLabel: `Main deck ${main.current} of ${main.target}`,
        icon: LayersIcon,
        badge: `${main.current}/${main.target}`,
      },
      {
        id: 'sideboard',
        label: 'Side',
        accessibilityLabel: `Sideboard ${side.current} of ${side.target}`,
        icon: InboxIcon,
        badge: `${side.current}/${side.target}`,
      },
    ];
  }, [deck]);

  const mobileSnapPoints = reduceMotion ? ['100%'] : ['78%', '100%'];
  const canEdit = !permanentReadOnly && Boolean(onEdit);

  return (
    <>
      <View className="relative min-h-0 flex-1">
        {permanentReadOnly ? (
          <View className="shrink-0">
            <DeckBuilderImportedBanner
              importBusy={importBusy}
              onImportToMyDecks={onImportToMyDecks}
            />
          </View>
        ) : null}

        <View className="shrink-0 pb-3">
          <DeckBuilderToolbar
            deck={deck}
            deckName={deck.name}
            readOnly={readOnly}
            validation={validation}
            onBack={handleBack}
            backAccessibilityLabel={readOnly ? 'Back to decks' : 'Back to deck'}
            onNameChange={
              readOnly
                ? undefined
                : (name) =>
                    onPersist((prev) => ({ ...prev, name, updatedAt: Date.now() }))
            }
            onToggleValidation={() => setValidationExpanded((v) => !v)}
            validationExpanded={validationExpanded}
            onImport={readOnly ? undefined : () => onIoModeChange('import')}
            onDuplicate={permanentReadOnly ? undefined : onDuplicate}
            onDelete={permanentReadOnly ? undefined : onDelete}
            duplicateBusy={duplicateBusy}
            onEdit={canEdit ? onEdit : undefined}
            infoDrawerOpen={infoDrawerOpen}
            onToggleInfoDrawer={
              isMobile || readOnly
                ? undefined
                : () => {
                    hapticPress();
                    setInfoDrawerOpen((open) => !open);
                  }
            }
            onOpenInfo={
              isMobile && !readOnly
                ? () => {
                    hapticPress();
                    setMobilePanel('info');
                  }
                : undefined
            }
            onOpenList={
              isMobile
                ? () => {
                    hapticPress();
                    setMobilePanel('list');
                  }
                : undefined
            }
            catalogSection={
              readOnly || middlePanel !== 'catalog' ? undefined : catalogSection
            }
            onCatalogSectionChange={
              readOnly || middlePanel !== 'catalog' ? undefined : focusCatalogSection
            }
            catalogSectionItems={
              readOnly || middlePanel !== 'catalog' ? undefined : browseSectionNavItems
            }
          />
        </View>

        <DeckBuilderWorkspace
          readOnly={readOnly}
          isMobile={isMobile}
          infoDrawerOpen={infoDrawerOpen}
          middlePanel={middlePanel}
          infoDrawer={infoDrawer}
          descriptionPanel={descriptionPanel}
          catalogPanel={catalogPanel}
          statsPanel={statsPanel}
          compositionList={compositionList}
          showcasePanel={showcasePanel}
        />
      </View>

      {isMobile ? (
        <DeckBuilderMobileSheet
          mobilePanel={mobilePanel}
          onClose={() => setMobilePanel(null)}
          mobileSnapPoints={mobileSnapPoints}
          reduceMotion={reduceMotion}
          sheetPaddingBottom={sheetPaddingBottom}
          infoDrawer={infoDrawer}
          compositionList={compositionList}
        />
      ) : null}

      {ioMode === 'import' && !readOnly ? (
        <DeckImportExportSheet
          open
          mode={ioMode}
          deck={deck}
          onClose={() => onIoModeChange(null)}
          onImport={(imported) => onPersist(imported)}
        />
      ) : null}
    </>
  );
}
