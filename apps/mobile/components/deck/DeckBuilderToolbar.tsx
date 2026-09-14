import {
  ThemedIcon,
  ChevronLeftIcon,
  DownloadIcon,
  InfoIcon,
  ListIcon,
  MenuIcon,
  PencilIcon,
} from '@/components/icons';
import { Pressable, View } from 'react-native';
import { DeckFormatBadge } from '@/components/deck/DeckFormatBadge';
import { DeckManageMenu } from '@/components/deck/DeckManageMenu';
import { DeckToolbarOverflowMenu } from '@/components/deck/DeckToolbarOverflowMenu';
import { DeckShareMenu } from '@/components/deck/DeckShareMenu';
import { DeckValidationMenu } from '@/components/deck/DeckValidationMenu';
import { DeckVersionMenu } from '@/components/deck/DeckVersionMenu';
import { PillNav, type PillNavItem } from '@/components/shell/FloatingPillNav';
import { TextInput } from '@/components/ui/text-input';
import { Text } from '@/components/ui/text';
import { deckFormatLabel } from '@riftbound/contracts';
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
}: DeckBuilderToolbarProps) {
  const isMobile = useMobileLayout();
  const nameDraft = useFocusedTextDraft(deckName, onNameChange ?? noopNameChange);

  const listButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open deck list"
      className={TOOLBAR_CONTROL}
      onPress={onOpenList}
    >
      <ThemedIcon icon={ListIcon} size={18} color="foreground" />
    </Pressable>
  );

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
      {isMobile && onOpenList ? listButton : null}
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

  const trailingActions = (
    <View className="z-20 shrink-0 flex-row items-center gap-1">
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

  const backAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={backAccessibilityLabel}
      className={TOOLBAR_CONTROL}
      onPress={onBack}
    >
      <ThemedIcon icon={ChevronLeftIcon} size={20} color="foreground" />
    </Pressable>
  );

  const versionSlot =
    deck.readOnly !== true && deck.versionId ? (
      <DeckVersionMenu deck={deck} fill={isMobile} />
    ) : null;

  if (isMobile) {
    const overflow = (
      <DeckToolbarOverflowMenu
        deck={deck}
        onImport={onImport}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        duplicateBusy={duplicateBusy}
      />
    );
    const hasToolsRow = sectionNav != null || onOpenInfo != null;
    // View mode: list + edit as two clear half-width actions instead of icons crowding the name.
    const viewActions =
      !hasToolsRow && (onOpenList || onEdit) ? (
        <View className="h-9 min-w-0 flex-row items-center gap-2">
          {onOpenList ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open deck list"
              className="h-9 min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-[3px] border border-border bg-card active:bg-card-panel"
              onPress={onOpenList}
            >
              <ThemedIcon icon={ListIcon} size={16} color="foreground" />
              <Text className="text-[13px] font-normal text-foreground">Deck list</Text>
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit deck"
              className={cn(
                'h-9 min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-[3px] active:opacity-80',
                OPERATE_SECONDARY_FILL_CLASS
              )}
              onPress={() => {
                hapticPress();
                onEdit();
              }}
            >
              <PencilIcon className="size-4 text-foreground" />
              <Text className="text-[13px] font-normal text-foreground">Edit deck</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null;

    // Row 1: identity + deck-level actions. Row 2 (editing): what the catalog shows + panels.
    return (
      <View className="z-20 min-w-0 gap-2">
        <View className="z-20 h-10 min-w-0 flex-row items-center gap-1.5">
          {backAction}
          <View className="min-w-0 flex-1 justify-center">
            <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
              {deckName.trim() || 'Untitled deck'}
            </Text>
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              {deckFormatLabel(deck.format)}
            </Text>
          </View>
          {versionSlot ? (
            <View className="min-w-[5.5rem] max-w-[34%] shrink-0">{versionSlot}</View>
          ) : null}
          {validationAction}
          {overflow}
        </View>
        {hasToolsRow ? (
          <View className="h-10 min-w-0 flex-row items-center gap-1.5">
            {sectionNav}
            <View className="min-w-0 flex-1" />
            {panelActions}
          </View>
        ) : (
          viewActions
        )}
      </View>
    );
  }

  return (
    <View className="z-20 h-9 min-w-0 flex-row items-center gap-1">
      {backAction}
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
        {versionSlot}
      </View>
      {sectionNav}
      {trailingActions}
    </View>
  );
}
