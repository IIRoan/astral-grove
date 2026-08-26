import { View } from 'react-native';
import { PlusIcon, ThemedIcon } from '@/components/icons';
import { DeckCreateMenu } from '@/components/deck/DeckCreateMenu';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { DeckFormat } from '@riftbound/contracts';

interface DecksListCreateRowProps {
  onCreateDeck: (format: DeckFormat) => Promise<void>;
}

export function DecksListCreateRow({ onCreateDeck }: DecksListCreateRowProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-[10px] border border-dashed border-border px-3.5 py-3">
      <View className="size-10 items-center justify-center rounded-[3px] border border-border bg-card-panel">
        <ThemedIcon icon={PlusIcon} size={18} color="foreground" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold leading-5 text-foreground">
          Start a new deck
        </Text>
        <Text className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
          Choose a format and add a legend
        </Text>
      </View>
      <DeckCreateMenu onCreate={onCreateDeck}>
        <Button size="sm" className="w-auto">
          <ButtonText>New deck</ButtonText>
        </Button>
      </DeckCreateMenu>
    </View>
  );
}
