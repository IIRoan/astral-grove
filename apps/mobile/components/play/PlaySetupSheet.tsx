import { PlayLegendPicker } from '@/components/play/PlayLegendPicker';
import { CheckIcon, ThemedIcon } from '@/components/icons';
import {
  AppSheet,
  AppSheetBody,
  AppSheetContent,
  AppSheetHeader,
  AppSheetOverlay,
  AppSheetPortal,
  AppSheetTitle,
} from '@/components/ui/app-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import {
  InlineList,
  InlineListItem,
  InlineListItemAddon,
  InlineListItemDescription,
  InlineListItemTitle,
} from '@/components/ui/inline-list';
import { Text } from '@/components/ui/text';
import {
  PLAY_FORMATS,
  type PlayFormatId,
  type ScoreTrackerState,
  type SeatLegend,
} from '@/lib/score-tracker';
import { hapticPress } from '@/utils/haptics';
import { useWindowDimensions, View } from 'react-native';

type PlaySetupSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open directly on that seat’s legend picker (not settings). */
  initialSeatId?: string | null;
  state: ScoreTrackerState;
  onSelectFormat: (formatId: PlayFormatId) => void;
  onSetLegend: (seatId: string, legend: SeatLegend | null) => void;
  onAdvanceMatch: () => void;
};

export function PlaySetupSheet({
  open,
  onOpenChange,
  initialSeatId = null,
  state,
  onSelectFormat,
  onSetLegend,
  onAdvanceMatch,
}: PlaySetupSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  // Parent passes the seat when opening; while closed, ignore so reopen starts on settings.
  const pickingSeatId = open ? initialSeatId : null;

  const format = PLAY_FORMATS.find((entry) => entry.id === state.format)!;
  const canAdvance = Boolean(format.trackMatchWins && state.winnerSeatId);
  const pickingSeat = state.seats.find((seat) => seat.id === pickingSeatId) ?? null;
  const legendDialogHeight = Math.min(720, Math.round(windowHeight * 0.82));

  return (
    <AppSheet open={open} onOpenChange={onOpenChange}>
      <AppSheetPortal name="play-setup">
        <AppSheetOverlay />
        <AppSheetContent
          {...(pickingSeat
            ? {
                snapPoints: ['92%'] as string[],
                defaultSnapIndex: 0,
                // Dialog mode ignores snap points — give the grid a real height.
                style: { height: legendDialogHeight },
              }
            : {})}
        >
          <AppSheetHeader>
            <AppSheetTitle>
              {pickingSeat ? 'Choose legend' : 'Play settings'}
            </AppSheetTitle>
          </AppSheetHeader>

          {pickingSeat ? (
            <View className="min-h-0 flex-1 px-4 pb-4">
              <PlayLegendPicker
                selectedVariantNumber={pickingSeat.legend?.variantNumber}
                onSelect={(legend) => {
                  onSetLegend(pickingSeat.id, legend);
                  onOpenChange(false);
                }}
                onClear={() => {
                  onSetLegend(pickingSeat.id, null);
                  onOpenChange(false);
                }}
              />
            </View>
          ) : (
            <AppSheetBody className="gap-3 pb-4">
              <Text className="text-sm leading-snug text-muted-foreground">
                How this table scores
              </Text>

              <InlineList>
                {PLAY_FORMATS.map((entry) => {
                  const selected = entry.id === state.format;
                  return (
                    <InlineListItem
                      key={entry.id}
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${entry.label}. ${entry.description}`}
                      onPress={() => {
                        void hapticPress();
                        onSelectFormat(entry.id);
                        onOpenChange(false);
                      }}
                    >
                      <InlineListItemTitle>{entry.label}</InlineListItemTitle>
                      <InlineListItemDescription>
                        {entry.description}
                      </InlineListItemDescription>
                      {selected ? (
                        <InlineListItemAddon align="inline-end">
                          <ThemedIcon icon={CheckIcon} size={18} color="foreground" />
                        </InlineListItemAddon>
                      ) : null}
                    </InlineListItem>
                  );
                })}
              </InlineList>

              {canAdvance ? (
                <Button
                  variant="outline"
                  className="border-border bg-card-panel"
                  onPress={() => {
                    void hapticPress();
                    onAdvanceMatch();
                    onOpenChange(false);
                  }}
                >
                  <ButtonText>Next game</ButtonText>
                </Button>
              ) : null}

              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                <ButtonText className="text-muted-foreground">Cancel</ButtonText>
              </Button>
            </AppSheetBody>
          )}
        </AppSheetContent>
      </AppSheetPortal>
    </AppSheet>
  );
}
