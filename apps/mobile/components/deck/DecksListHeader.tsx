import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, ButtonText } from '@/components/ui/button';
import { DeckCreateMenu } from '@/components/deck/DeckCreateMenu';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import type { DeckFormat } from '@riftbound/contracts';
import { hapticPress } from '@/utils/haptics';

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
  nav?: ReactNode;
  ownedToolbar?: ReactNode;
  browseToolbar?: ReactNode;
  shrinkHeader?: boolean;
}

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
  nav,
  ownedToolbar,
  browseToolbar,
  shrinkHeader,
}: DecksListHeaderProps) {
  return (
    <View className={`mb-4 w-full gap-3${shrinkHeader ? ' shrink-0' : ''}`}>
      <View className="w-full flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 shrink" style={{ minWidth: 0 }}>
          <Text className="text-2xl font-normal tracking-tight text-foreground">
            {title}
          </Text>
          <Text className="mt-1 font-mono text-[13px] text-muted-foreground">
            {query.trim()
              ? `${deckCountLabel} matching “${query.trim()}”`
              : deckCountLabel}
          </Text>
        </View>
        {showCreate || showImport ? (
          <View className="shrink-0 flex-row gap-2 self-start">
            {showImport ? (
              <Button
                variant="outline"
                className="w-auto"
                onPress={() => {
                  hapticPress();
                  onImportPress();
                }}
              >
                <ButtonText>Import deck</ButtonText>
              </Button>
            ) : null}
            {showCreate ? <DeckCreateMenu onCreate={onCreateDeck} /> : null}
          </View>
        ) : null}
      </View>

      <SearchInput
        value={query}
        onChangeText={onQueryChange}
        placeholder={searchPlaceholder}
        accessibilityLabel={searchPlaceholder}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {nav || ownedToolbar ? (
        <View className="flex-row flex-wrap items-center gap-2">
          {nav}
          {ownedToolbar}
        </View>
      ) : null}

      {browseToolbar}
    </View>
  );
}
