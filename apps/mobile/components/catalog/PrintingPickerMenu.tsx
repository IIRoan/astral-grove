import { cloneElement, isValidElement, useCallback, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
  usePopover,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import {
  VariantPickerSheet,
  type VariantPickerOption,
} from '@/components/ui/VariantPickerSheet';

interface PrintingPickerMenuProps {
  title: string;
  options: VariantPickerOption[];
  onSelect: (variantNumber: string) => void;
  children: React.ReactElement<{ onPress?: () => void; disabled?: boolean }>;
}

function PrintingMenuItems({
  options,
  onSelect,
}: {
  options: VariantPickerOption[];
  onSelect: (id: string) => void;
}) {
  const { onOpenChange } = usePopover();

  return (
    <View className="gap-0.5">
      {options.map((option) => {
        return (
          <PopoverClose key={option.id} asChild>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityLabel={`Select ${option.label} printing ${option.id}`}
              testID={`printing-option-${option.id}`}
              className="flex-row items-center justify-between gap-3 rounded-[3px] px-2.5 py-2 active:bg-card-panel"
              onPress={() => {
                onSelect(option.id);
                onOpenChange(false);
              }}
            >
              <View className="min-w-0 flex-1 flex-row items-center gap-2">
                <Text
                  className="text-[13px] font-normal text-foreground"
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </View>
              {option.price ? (
                <Text className="font-mono text-xs text-muted-foreground">
                  {option.price}
                </Text>
              ) : null}
            </Pressable>
          </PopoverClose>
        );
      })}
    </View>
  );
}

export function PrintingPickerMenu({
  title,
  options,
  onSelect,
  children,
}: PrintingPickerMenuProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setSheetOpen(false);
    },
    [onSelect]
  );

  if (Platform.OS === 'web') {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverPortal>
          <PopoverOverlay className="bg-transparent" closeOnPress />
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={6}
            className="min-w-[220px] border border-border bg-card p-1 shadow-none"
          >
            <Text className="px-2.5 pb-1 pt-2.5 font-mono text-[11px] font-normal uppercase tracking-[-0.24px] text-muted-foreground">
              {title}
            </Text>
            <PrintingMenuItems options={options} onSelect={handleSelect} />
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    );
  }

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        onPress: () => {
          setSheetOpen(true);
        },
      })
    : children;

  return (
    <>
      {trigger}
      <VariantPickerSheet
        visible={sheetOpen}
        title={title}
        options={options}
        onClose={() => {
          setSheetOpen(false);
        }}
        onSelect={handleSelect}
      />
    </>
  );
}
