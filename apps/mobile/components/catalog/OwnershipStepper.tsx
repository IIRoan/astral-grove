import { MinusIcon, PlusIcon, ThemedIcon } from '@/components/icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useMemo, type ReactElement } from 'react';
import { PrintingPickerMenu } from '@/components/catalog/PrintingPickerMenu';
import { Text } from '@/components/ui/text';
import type { VariantPickerOption } from '@/components/ui/VariantPickerSheet';
import {
  buildPrintingPickerOptions,
  getRemovePrintingPickerOptions,
  printingSelectionId,
  resolveQuickAddSelection,
  resolveQuickRemoveSelection,
  shouldShowPrintingPicker,
  shouldShowRemovePrintingPicker,
  type PrintingWithOwned,
} from '@/utils/collectionPrintingPicker';
import { cn } from '@/lib/utils';
import {
  OPERATE_CTA_FILL_CLASS,
  OPERATE_CTA_ICON_CLASS,
  OPERATE_CTA_SPINNER_CLASS,
} from '@/constants/operateType';

interface OwnershipStepperProps {
  owned: number;
  name: string;
  compact?: boolean;
  relaxed?: boolean;
  /** Fill a fixed-width grid tile slot — Add and stepper share the same footprint. */
  gridSlot?: boolean;
  busy?: boolean;
  printings?: PrintingWithOwned[];
  fixedVariantNumber?: string;
  fixedIsFoil?: boolean;
  /** Skip foil/standard picker on add; inserts the default (non-foil) finish. */
  simpleAdd?: boolean;
  onAdd: (selectionId?: string) => void;
  onRemove: (selectionId?: string) => void;
}

function wrapWithPrintingPicker(
  title: string,
  options: VariantPickerOption[],
  onSelect: (id: string) => void,
  node: ReactElement<{ onPress?: () => void; disabled?: boolean }>
) {
  return (
    <PrintingPickerMenu title={title} options={options} onSelect={onSelect}>
      {node}
    </PrintingPickerMenu>
  );
}

export function OwnershipStepper({
  owned,
  name,
  compact = false,
  relaxed = false,
  gridSlot = false,
  busy = false,
  printings,
  fixedVariantNumber,
  fixedIsFoil,
  simpleAdd = false,
  onAdd,
  onRemove,
}: OwnershipStepperProps) {
  const pickerOptions = useMemo(
    () => buildPrintingPickerOptions(printings ?? []),
    [printings]
  );

  const pinnedSelectionId =
    fixedVariantNumber != null && fixedIsFoil !== undefined
      ? printingSelectionId({ variantNumber: fixedVariantNumber, isFoil: fixedIsFoil })
      : fixedVariantNumber;

  const multiple = shouldShowPrintingPicker(printings, fixedVariantNumber);
  const showAddPicker = multiple && !simpleAdd;
  const showRemovePicker = shouldShowRemovePrintingPicker(
    printings,
    fixedVariantNumber
  );
  const removeOptions = useMemo(
    () => getRemovePrintingPickerOptions(printings ?? [], pickerOptions),
    [printings, pickerOptions]
  );

  /** Compact + relaxed = card-detail drawer rows (larger +/− hit targets). */
  const detailTouch = compact && relaxed && !gridSlot;
  const iconSize = detailTouch ? 16 : relaxed ? 12 : 11;
  /** Keep Add + owned stepper the same height to avoid tile layout shift. */
  const controlHeight = gridSlot
    ? 'h-7'
    : detailTouch
      ? 'h-10'
      : compact
        ? 'h-7'
        : relaxed
          ? 'h-8'
          : 'h-7';
  const stepSize = gridSlot
    ? 'size-7'
    : detailTouch
      ? 'size-10'
      : compact
        ? 'size-7'
        : relaxed
          ? 'size-8'
          : 'size-7';
  /** Shared footprint so Add ↔ owned doesn't jump in detail rows. */
  const controlWidth =
    compact && !gridSlot
      ? detailTouch
        ? 'min-w-[7.25rem]'
        : 'min-w-[5.75rem]'
      : undefined;

  const addDefaultFinish = () => {
    if (pinnedSelectionId) {
      onAdd(pinnedSelectionId);
      return;
    }
    const selection = resolveQuickAddSelection(printings);
    if (!selection) return;
    onAdd(printingSelectionId(selection));
  };

  const renderAddButton = (title: string) => {
    const button = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${name} to collection`}
        className={cn(
          'flex-row items-center justify-center gap-1 rounded-[3px] px-2.5 active:opacity-80',
          OPERATE_CTA_FILL_CLASS,
          gridSlot ? 'w-full' : 'w-auto shrink-0',
          controlWidth,
          controlHeight,
          relaxed && 'px-3',
          busy && 'opacity-60'
        )}
        onPress={showAddPicker ? undefined : addDefaultFinish}
        disabled={busy}
      >
        {busy && !showAddPicker ? (
          <ActivityIndicator size="small" className={OPERATE_CTA_SPINNER_CLASS} />
        ) : (
          <>
            <PlusIcon
              className={cn(
                OPERATE_CTA_ICON_CLASS,
                detailTouch ? 'size-4' : relaxed ? 'size-3.5' : 'size-3'
              )}
              weight="bold"
            />
            <Text
              className={cn(
                'font-medium tracking-tight text-cta-foreground',
                detailTouch ? 'text-[13px]' : 'text-[11px]'
              )}
            >
              Add
            </Text>
          </>
        )}
      </Pressable>
    );

    return showAddPicker
      ? wrapWithPrintingPicker(title, pickerOptions, onAdd, button)
      : button;
  };

  const renderStepButton = (
    direction: 'add' | 'remove',
    onPress: (() => void) | undefined,
    showPicker: boolean,
    pickerTitle: string,
    pickerOptionsFiltered: typeof pickerOptions,
    onSelect: (id: string) => void
  ) => {
    const icon = direction === 'add' ? PlusIcon : MinusIcon;
    const label = direction === 'add' ? `Add one ${name}` : `Remove one ${name}`;

    const button = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        className={cn(
          'items-center justify-center rounded-[3px] active:bg-foreground/10',
          gridSlot ? 'h-full flex-1' : stepSize
        )}
        onPress={showPicker ? undefined : onPress}
        disabled={busy}
      >
        {busy && !showPicker ? (
          <ActivityIndicator size="small" className="accent-foreground" />
        ) : (
          <ThemedIcon icon={icon} size={iconSize} color="foreground" />
        )}
      </Pressable>
    );

    return showPicker
      ? wrapWithPrintingPicker(pickerTitle, pickerOptionsFiltered, onSelect, button)
      : button;
  };

  if (owned > 0) {
    return (
      <View
        className={cn(
          'flex-row items-center rounded-[3px] border border-border bg-card-panel',
          gridSlot
            ? 'w-full justify-between'
            : cn('justify-between gap-0.5', controlWidth),
          controlHeight,
          busy && 'opacity-60'
        )}
      >
        {renderStepButton(
          'remove',
          () => {
            const selection = resolveQuickRemoveSelection(printings, pinnedSelectionId);
            if (!selection) return;
            onRemove(printingSelectionId(selection));
          },
          showRemovePicker,
          'Remove printing',
          removeOptions,
          onRemove
        )}
        <Text
          className={cn(
            'shrink-0 text-center font-mono font-normal tabular-nums text-foreground',
            gridSlot
              ? 'min-w-7 text-xs'
              : detailTouch
                ? 'min-w-7 text-sm'
                : compact
                  ? 'min-w-5 text-[11px]'
                  : relaxed
                    ? 'min-w-6 text-[13px]'
                    : 'min-w-6 text-[12px]'
          )}
        >
          {owned}
        </Text>
        {renderStepButton(
          'add',
          addDefaultFinish,
          showAddPicker,
          'Add printing',
          pickerOptions,
          onAdd
        )}
      </View>
    );
  }

  return renderAddButton('Select printing');
}
