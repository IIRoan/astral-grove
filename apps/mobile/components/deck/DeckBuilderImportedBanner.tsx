import { DownloadIcon, ThemedIcon } from '@/components/icons';
import { Pressable, View } from 'react-native';
import { StatusKeywordBadge } from '@/components/riftbound/RiftboundBadges';
import { Text } from '@/components/ui/text';
import { hapticPress } from '@/utils/haptics';
import { cn } from '@/lib/utils';

interface DeckBuilderImportedBannerProps {
  importBusy: boolean;
  onImportToMyDecks?: () => void;
}

export function DeckBuilderImportedBanner({
  importBusy,
  onImportToMyDecks,
}: DeckBuilderImportedBannerProps) {
  return (
    <View className="flex-row items-center gap-2 border-b border-border pb-2.5">
      <StatusKeywordBadge status="imported" compact />
      <Text
        className="min-w-0 flex-1 text-[12px] text-muted-foreground"
        numberOfLines={1}
      >
        View only · from Piltover Archive
      </Text>
      {onImportToMyDecks ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={importBusy ? 'Importing deck' : 'Import to my decks'}
          accessibilityState={{ disabled: importBusy, busy: importBusy }}
          disabled={importBusy}
          className={cn(
            'flex-row items-center gap-1 rounded-[3px] border border-border bg-card px-2.5 py-1.5',
            importBusy ? 'opacity-50' : 'active:bg-card-panel'
          )}
          onPress={() => {
            hapticPress();
            onImportToMyDecks();
          }}
        >
          <ThemedIcon icon={DownloadIcon} size={14} color="foreground" />
          <Text className="text-[12px] font-normal text-foreground">
            {importBusy ? 'Importing…' : 'Import'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
