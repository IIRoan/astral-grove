import { collectionFinishKey } from '@riftbound/contracts';
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
import type { CollectedPrintingRow } from '@/utils/collectionRemove';

interface Props {
  visible: boolean;
  cardName: string;
  items: CollectedPrintingRow[];
  onClose: () => void;
  onRemovePrinting: (selection: { variantNumber: string; isFoil: boolean }) => void;
  onRemoveAll: () => void;
}

export function RemoveCollectionSheet({
  visible,
  cardName,
  items,
  onClose,
  onRemovePrinting,
  onRemoveAll,
}: Props) {
  return (
    <AppSheet
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AppSheetPortal name="remove-collection">
        <AppSheetOverlay />
        <AppSheetContent>
          <AppSheetHeader>
            <AppSheetTitle>Remove from collection</AppSheetTitle>
          </AppSheetHeader>
          <AppSheetBody className="gap-3 pb-4">
            <Text className="text-sm leading-5 text-muted-foreground">
              You have multiple printings of {cardName}. Which should be removed?
            </Text>

            <InlineList>
              {items.map((item) => (
                <InlineListItem
                  key={collectionFinishKey(item.variantNumber, item.isFoil)}
                  onPress={() => {
                    onRemovePrinting({
                      variantNumber: item.variantNumber,
                      isFoil: item.isFoil,
                    });
                  }}
                >
                  <InlineListItemTitle>{item.label}</InlineListItemTitle>
                  <InlineListItemDescription>
                    {item.variantNumber}
                  </InlineListItemDescription>
                  <InlineListItemAddon align="inline-end">
                    <Text className="text-[13px] font-normal text-ring">
                      {item.quantity > 1 ? `−1 (×${String(item.quantity)})` : 'Remove'}
                    </Text>
                  </InlineListItemAddon>
                </InlineListItem>
              ))}
            </InlineList>

            {items.length > 1 ? (
              <Button
                variant="outline"
                className="border-foreground/40 bg-foreground/5"
                onPress={onRemoveAll}
              >
                <ButtonText className="text-ring">Remove all printings</ButtonText>
              </Button>
            ) : null}

            <Button variant="ghost" onPress={onClose}>
              <ButtonText className="text-muted-foreground">Cancel</ButtonText>
            </Button>
          </AppSheetBody>
        </AppSheetContent>
      </AppSheetPortal>
    </AppSheet>
  );
}
