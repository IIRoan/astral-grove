import type { ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Accordion,
  AccordionContent,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetOverlay,
  BottomSheetPortal,
  BottomSheetScrollView,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import {
  FILTER_OPTION_CHIP_ACTIVE_CLASS,
  FILTER_OPTION_CHIP_ACTIVE_TEXT_CLASS,
  FILTER_OPTION_CHIP_CLASS,
  FILTER_OPTION_CHIP_IDLE_CLASS,
  FILTER_OPTION_CHIP_IDLE_TEXT_CLASS,
} from '@/constants/catalogToolbar';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { cn } from '@/lib/utils';

interface MobileFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  activeCount: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  doneLabel?: string;
  portalName: string;
  stickyHeader?: ReactNode;
  children: ReactNode;
}

export function MobileFilterSheet({
  visible,
  onClose,
  title = 'Filters',
  activeCount,
  hasActiveFilters,
  onClear,
  doneLabel = 'Filter',
  portalName,
  stickyHeader,
  children,
}: MobileFilterSheetProps) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const snapPoints = ['100%'];
  const scrollPaddingBottom = Math.max(insets.bottom, 16) + 56;

  return (
    <BottomSheet
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheetPortal name={portalName}>
        <BottomSheetOverlay />
        <BottomSheetContent
          snapPoints={snapPoints}
          defaultSnapIndex={0}
          enablePanDownToClose
          enableOverDrag={!reduceMotion}
          className="bg-card-panel"
        >
          <BottomSheetHeader className="border-b border-border bg-card-panel">
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  <BottomSheetTitle>{title}</BottomSheetTitle>
                  {hasActiveFilters ? (
                    <View
                      className={cn(
                        'h-6 min-w-6 items-center justify-center border border-border bg-card-panel px-1.5',
                        FACTORY_RADIUS_CONTROL_CLASS
                      )}
                    >
                      <Text className="font-mono text-[11px] font-normal text-foreground">
                        {activeCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {hasActiveFilters ? (
                  <Pressable
                    onPress={onClear}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear all filters"
                    className="shrink-0 active:opacity-70"
                  >
                    <Text className="text-sm font-normal text-foreground">
                      Clear all
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {stickyHeader ? <View>{stickyHeader}</View> : null}
            </View>
          </BottomSheetHeader>

          <BottomSheetScrollView
            contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </BottomSheetScrollView>

          <BottomSheetFooter className="border-border border-t bg-card-panel pt-3">
            <Button
              className={cn(
                'h-10 w-full active:opacity-80',
                FACTORY_RADIUS_CONTROL_CLASS
              )}
              onPress={onClose}
            >
              <ButtonText className="text-sm font-medium text-cta-foreground">
                {doneLabel}
              </ButtonText>
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetPortal>
    </BottomSheet>
  );
}

interface FilterAccordionSectionProps {
  value: string;
  label: string;
  summary?: string;
  active: boolean;
  children: ReactNode;
}

export function FilterAccordionSection({
  value,
  label,
  summary,
  active,
  children,
}: FilterAccordionSectionProps) {
  return (
    <AccordionItem value={value} className="bg-transparent">
      <AccordionTrigger className="rounded-[10px] bg-card px-3 py-3">
        <View className="min-w-0 flex-1 pr-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-normal text-foreground">{label}</Text>
            {active ? <View className="size-1.5 rounded-full bg-foreground" /> : null}
          </View>
          {summary ? (
            <Text
              className="mt-0.5 text-[12px] text-muted-foreground"
              numberOfLines={1}
            >
              {summary}
            </Text>
          ) : null}
        </View>
        <AccordionIndicator />
      </AccordionTrigger>
      <AccordionContent className="px-1 pt-2 pb-1">{children}</AccordionContent>
    </AccordionItem>
  );
}

interface FilterAccordionGroupProps {
  defaultOpen: string[];
  children: ReactNode;
}

export function FilterAccordionGroup({
  defaultOpen,
  children,
}: FilterAccordionGroupProps) {
  return (
    <View className="gap-2">
      <Accordion type="multiple" defaultValue={defaultOpen} collapsible>
        {children}
      </Accordion>
    </View>
  );
}

export function FilterOptionChip({
  label,
  active,
  onPress,
  leading,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  leading?: ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      className={cn(
        FILTER_OPTION_CHIP_CLASS,
        active ? FILTER_OPTION_CHIP_ACTIVE_CLASS : FILTER_OPTION_CHIP_IDLE_CLASS
      )}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      {...(Platform.OS === 'web' ? { 'aria-checked': active } : null)}
    >
      {leading}
      <Text
        className={cn(
          'text-sm',
          active
            ? FILTER_OPTION_CHIP_ACTIVE_TEXT_CLASS
            : FILTER_OPTION_CHIP_IDLE_TEXT_CLASS
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FilterChipGrid({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}
