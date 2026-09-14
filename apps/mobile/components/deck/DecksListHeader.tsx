import type { ReactNode } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { DownloadIcon, PlusIcon } from '@/components/icons';
import { CatalogToolbarButton } from '@/components/catalog/CatalogToolbarButton';
import { Button, ButtonText } from '@/components/ui/button';
import { DeckCreateMenu } from '@/components/deck/DeckCreateMenu';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { BREAKPOINTS } from '@/lib/responsive-layout';
import { cn } from '@/lib/utils';
import type { DeckFormat } from '@riftbound/contracts';

interface DecksListHeaderProps {
  title: string;
  deckCountLabel: string;
  query: string;
  searchPlaceholder: string;
  onQueryChange: (value: string) => void;
  showCreate: boolean;
  showImport: boolean;
  onImportPress: () => void;
  onCreateDeck: (format: DeckFormat) => Promise<void>;
  /** Mine / Browse switch; receives `iconOnly` when space is tight. */
  renderNav?: (options: { iconOnly: boolean }) => ReactNode;
  /** Controls that sit to the right of search (sort, filters, view options). */
  searchActions?: ReactNode;
  /** Optional extra row (active filter chips, desktop filter bar). */
  below?: ReactNode;
  shrinkHeader?: boolean;
}

/**
 * Deck list chrome in two rows:
 * phones  → [Mine|Browse] … [Import][New]  /  [Search][actions]
 * desktop → title + count … [Import deck][New deck]  /  [Mine|Browse][Search][actions]
 */
export function DecksListHeader({
  title,
  deckCountLabel,
  query,
  searchPlaceholder,
  onQueryChange,
  showCreate,
  showImport,
  onImportPress,
  onCreateDeck,
  renderNav,
  searchActions,
  below,
  shrinkHeader,
}: DecksListHeaderProps) {
  const isMobile = useMobileLayout();
  const { width } = useWindowDimensions();
  const countLabel = query.trim()
    ? `${deckCountLabel} matching “${query.trim()}”`
    : deckCountLabel;

  const actions =
    showCreate || showImport ? (
      <View className="shrink-0 flex-row items-center gap-2">
        {showImport ? (
          isMobile ? (
            <CatalogToolbarButton
              icon={DownloadIcon}
              mobile
              accessibilityLabel="Import deck"
              onPress={onImportPress}
            />
          ) : (
            <Button
              variant="outline"
              className="w-auto"
              accessibilityLabel="Import deck"
              onPress={onImportPress}
            >
              <ButtonText>Import deck</ButtonText>
            </Button>
          )
        ) : null}
        {showCreate ? (
          <DeckCreateMenu onCreate={onCreateDeck}>
            {isMobile ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New deck"
                className={cn(
                  'size-11 items-center justify-center bg-cta active:opacity-80',
                  FACTORY_RADIUS_CONTROL_CLASS
                )}
              >
                <PlusIcon className="size-5 text-cta-foreground" />
              </Pressable>
            ) : undefined}
          </DeckCreateMenu>
        ) : null}
      </View>
    ) : null;

  const search = (
    <SearchInput
      value={query}
      onChangeText={onQueryChange}
      placeholder={searchPlaceholder}
      accessibilityLabel={searchPlaceholder}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="search"
      className="min-w-0 flex-1"
    />
  );

  if (isMobile) {
    // Below ~360pt the labeled switch plus two actions no longer fits one row.
    const navIconOnly = width < BREAKPOINTS.compact;
    return (
      <View className={cn('mb-3 w-full gap-2', shrinkHeader && 'shrink-0')}>
        <View className="w-full flex-row items-center justify-between gap-2">
          <View className="min-w-0 shrink flex-row items-center gap-2">
            {renderNav?.({ iconOnly: navIconOnly })}
            {!renderNav ? (
              <Text className="text-xl font-normal text-foreground" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
          {actions}
        </View>
        <View className="w-full flex-row items-center gap-2">
          {search}
          {searchActions}
        </View>
        {below}
      </View>
    );
  }

  return (
    <View className={cn('mb-4 w-full gap-3', shrinkHeader && 'shrink-0')}>
      <View className="w-full flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-baseline gap-3">
          <Text className="text-2xl font-normal tracking-tight text-foreground">
            {title}
          </Text>
          <Text
            className="shrink font-mono text-[13px] text-muted-foreground"
            numberOfLines={1}
          >
            {countLabel}
          </Text>
        </View>
        {actions}
      </View>
      <View className="w-full flex-row items-center gap-2">
        {renderNav?.({ iconOnly: false })}
        {search}
        {searchActions}
      </View>
      {below}
    </View>
  );
}
