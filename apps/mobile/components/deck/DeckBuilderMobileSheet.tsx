import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetOverlay,
  BottomSheetPortal,
  BottomSheetScrollView,
} from '@/components/ui/bottom-sheet';

type MobilePanel = 'info' | 'list' | null;

interface DeckBuilderMobileSheetProps {
  mobilePanel: MobilePanel;
  onClose: () => void;
  mobileSnapPoints: string[];
  reduceMotion: boolean;
  sheetPaddingBottom: number;
  infoDrawer: React.ReactNode;
  compositionList: React.ReactNode;
}

export function DeckBuilderMobileSheet({
  mobilePanel,
  onClose,
  mobileSnapPoints,
  reduceMotion,
  sheetPaddingBottom,
  infoDrawer,
  compositionList,
}: DeckBuilderMobileSheetProps) {
  // Open on the tallest snap so the deck list has room; users can still drag shorter.
  const defaultSnapIndex = Math.max(0, mobileSnapPoints.length - 1);

  return (
    <BottomSheet
      open={mobilePanel != null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <BottomSheetPortal>
        <BottomSheetOverlay />
        <BottomSheetContent
          snapPoints={mobileSnapPoints}
          defaultSnapIndex={defaultSnapIndex}
          enablePanDownToClose
          enableOverDrag={!reduceMotion}
          enableContentPanningGesture
        >
          {mobilePanel === 'info' ? (
            <BottomSheetScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: sheetPaddingBottom }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {infoDrawer}
            </BottomSheetScrollView>
          ) : null}
          {mobilePanel === 'list' ? (
            <BottomSheetScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: sheetPaddingBottom }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {compositionList}
            </BottomSheetScrollView>
          ) : null}
        </BottomSheetContent>
      </BottomSheetPortal>
    </BottomSheet>
  );
}
