import {
  ThemedIcon,
  ChevronLeftIcon,
  DownloadIcon,
  InfoIcon,
  ListIcon,
  MenuIcon,
  PencilIcon,
  SlidersHorizontalIcon,
} from '@/components/icons';
import { Pressable, View } from 'react-native';
import { DeckFormatBadge } from '@/components/deck/DeckFormatBadge';
import { DeckManageMenu } from '@/components/deck/DeckManageMenu';
import { DeckShareMenu } from '@/components/deck/DeckShareMenu';
import { DeckValidationMenu } from '@/components/deck/DeckValidationMenu';
import { PillNav, type PillNavItem } from '@/components/shell/FloatingPillNav';
import { TextInput } from '@/components/ui/text-input';
import { Text } from '@/components/ui/text';
import { countCatalogFilters, type CatalogFilters } from '@/constants/catalogFilters';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useFocusedTextDraft } from '@/hooks/useFocusedTextDraft';
import type { DeckState, DeckValidationMessage } from '@/lib/deck-types';
import { OPERATE_SECONDARY_FILL_CLASS } from '@/constants/operateType';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

type DeckCatalogSection = 'mainDeck' | 'sideboard';

const noopNameChange = (_name: string) => undefined;

/** Shared size for every deck-builder toolbar control (36×36). */
const TOOLBAR_CONTROL =
  'size-9 shrink-0 items-center justify-center rounded-[3px] border border-border bg-card active:bg-card-panel';

interface DeckBuilderToolbarProps {
  deck: DeckState;
  deckName: string;
  readOnly?: boolean;
  validation: DeckValidationMessage[];
  onBack: () => void;
  backAccessibilityLabel?: string;
  onNameChange?: (name: string) => void;
  onToggleValidation?: () => void;
  validationExpanded?: boolean;
  onImport?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  duplicateBusy?: boolean;
  onEdit?: () => void;
  infoDrawerOpen?: boolean;
  onToggleInfoDrawer?: () => void;
  onOpenInfo?: () => void;
  onOpenList?: () => void;
  catalogSection?: DeckCatalogSection;
  onCatalogSectionChange?: (section: DeckCatalogSection) => void;
  catalogSectionItems?: readonly PillNavItem<DeckCatalogSection>[];
  catalogFilters?: CatalogFilters;
  onOpenCatalogFilters?: () => void;
}

export function DeckBuilderToolbar({
  deck,
  deckName,
  readOnly = false,
  validation,
  onBack,
  backAccessibilityLabel = 'Back to decks',
  onNameChange,
  onToggleValidation,
  validationExpanded = false,
  onImport,
  onDuplicate,
  onDelete,
  duplicateBusy = false,
  onEdit,
  infoDrawerOpen,
  onToggleInfoDrawer,
  onOpenInfo,
  onOpenList,
  catalogSection,
  onCatalogSectionChange,
  catalogSectionItems,
  catalogFilters,
  onOpenCatalogFilters,
}: DeckBuilderToolbarProps) {
  const isMobile = useMobileLayout();
  const nameDraft = useFocusedTextDraft(deckName, onNameChange ?? noopNameChange);
  const showCatalogFilters =
    isMobile && !readOnly && catalogFilters != null && onOpenCatalogFilters != null;
  const filterCount = showCatalogFilters ? countCatalogFilters(catalogFilters) : 0;
  const filterActive = filterCount > 0;

  const panelActions = (
    <>
      {isMobile && onOpenInfo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open deck info"
          className={TOOLBAR_CONTROL}
          onPress={onOpenInfo}
        >
          <ThemedIcon icon={InfoIcon} size={18} color="foreground" />
        </Pressable>
      ) : null}
      {isMobile && onOpenList ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open deck list"
          className={TOOLBAR_CONTROL}
          onPress={onOpenList}
        >
          <ThemedIcon icon={ListIcon} size={18} color="foreground" />
        </Pressable>
      ) : null}
      {!isMobile && onToggleInfoDrawer ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={infoDrawerOpen ? 'Hide deck info' : 'Show deck info'}
          accessibilityState={{ selected: infoDrawerOpen === true }}
          className={cn(TOOLBAR_CONTROL, infoDrawerOpen && 'border-foreground')}
          onPress={onToggleInfoDrawer}
        >
          <ThemedIcon icon={MenuIcon} size={18} color="foreground" />
        </Pressable>
      ) : null}
    </>
  );

  const editAction = onEdit ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edit deck"
      className={cn(
        'h-9 shrink-0 flex-row items-center gap-1.5 rounded-[3px] px-2.5 active:opacity-80',
        OPERATE_SECONDARY_FILL_CLASS
      )}
      onPress={() => {
        hapticPress();
        onEdit();
      }}
    >
      <PencilIcon className="size-4 text-foreground" />
      <Text className="text-[13px] font-normal text-foreground">Edit</Text>
    </Pressable>
  ) : null;

  const ioActions = (
    <>
      {onImport ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import deck list"
          className={TOOLBAR_CONTROL}
          onPress={onImport}
        >
          <ThemedIcon icon={DownloadIcon} size={18} color="foreground" />
        </Pressable>
      ) : null}
      <DeckShareMenu deck={deck} />
      <DeckManageMenu
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        duplicateBusy={duplicateBusy}
      />
    </>
  );

  const validationAction =
    validation.length > 0 && onToggleValidation ? (
      <DeckValidationMenu
        messages={validation}
        open={validationExpanded}
        onOpenChange={() => onToggleValidation()}
        showLabel={!isMobile}
        align="end"
        className={isMobile ? 'h-9' : undefined}
      />
    ) : null;

  const catalogFilterAction = showCatalogFilters ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open filters"
      className={cn(
        TOOLBAR_CONTROL,
        'relative',
        filterActive && 'border-foreground bg-card-panel'
      )}
      onPress={() => {
        hapticPress();
        onOpenCatalogFilters();
      }}
    >
      <ThemedIcon
        icon={SlidersHorizontalIcon}
        size={18}
        color={filterActive ? 'foreground' : 'muted-foreground'}
      />
      {filterActive ? (
        filterCount === 1 ? (
          <View className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-foreground" />
        ) : (
          <View className="absolute -right-1 -top-1 size-4 items-center justify-center rounded-[3px] border border-border bg-card-panel">
            <Text className="font-mono text-[9px] font-normal text-foreground">
              {filterCount}
            </Text>
          </View>
        )
      ) : null}
    </Pressable>
  ) : null;

  const trailingActions = (
    <View className="z-20 shrink-0 flex-row items-center gap-1">
      {catalogFilterAction}
      {panelActions}
      {ioActions}
      {validationAction}
      {editAction}
    </View>
  );

  const sectionNav =
    catalogSection != null &&
    onCatalogSectionChange &&
    catalogSectionItems &&
    catalogSectionItems.length > 0 ? (
      <PillNav
        items={catalogSectionItems}
        value={catalogSection}
        onChange={onCatalogSectionChange}
        compact
        iconOnly={isMobile}
        className="shrink-0"
      />
    ) : null;

  return (
    <View className="z-20 h-9 min-w-0 flex-row items-center gap-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel}
        className={TOOLBAR_CONTROL}
        onPress={onBack}
      >
        <ThemedIcon icon={ChevronLeftIcon} size={20} color="foreground" />
      </Pressable>

      {isMobile ? (
        <>
          <DeckFormatBadge format={deck.format} variant="toolbar" />
          {sectionNav}
          <View className="min-w-0 flex-1" />
          {trailingActions}
        </>
      ) : (
        <>
          <View className="min-h-0 min-w-0 flex-1 flex-row items-center gap-2">
            <DeckFormatBadge format={deck.format} variant="toolbar" />
            <View className="min-h-0 min-w-0 flex-1 justify-center">
              {!readOnly && onNameChange ? (
                <TextInput
                  value={nameDraft.value}
                  onChangeText={nameDraft.onChangeText}
                  onFocus={nameDraft.onFocus}
                  onBlur={nameDraft.onBlur}
                  placeholder="Deck name"
                  className="h-9 min-h-9 py-0 text-base font-normal"
                />
              ) : (
                <Text className="text-lg font-normal text-foreground" numberOfLines={1}>
                  {deckName}
                </Text>
              )}
            </View>
          </View>
          {sectionNav}
          {trailingActions}
        </>
      )}
    </View>
  );
}
