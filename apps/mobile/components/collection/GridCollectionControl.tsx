import { ThemedIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useMemo } from 'react';
import { PrintingPickerMenu } from '@/components/catalog/PrintingPickerMenu';
import { Text } from '@/components/ui/text';
import {
  OPERATE_CTA_FILL_CLASS,
  OPERATE_CTA_ICON_CLASS,
  OPERATE_CTA_LABEL_CLASS,
  OPERATE_CTA_SPINNER_CLASS,
  OPERATE_QTY_CLASS,
} from '@/constants/operateType';
import {
  buildPrintingPickerOptions,
  getRemovePrintingPickerOptions,
  printingSelectionId,
  resolveQuickAddSelection,
  resolveQuickRemoveSelection,
  shouldShowPrintingPicker,
  shouldShowRemovePrintingPicker,
  type PrintingPickerOption,
  type PrintingWithOwned,
} from '@/utils/collectionPrintingPicker';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface Props {
  owned: number;
  name: string;
  busy?: boolean;
  printings?: PrintingWithOwned[];
  fixedVariantNumber?: string;
  /** Skip foil/standard picker on add; inserts the default (non-foil) finish. */
  simpleAdd?: boolean;
  onAdd: (selectionId?: string) => void;
  onRemove: (selectionId?: string) => void;
}

function wrapWithPicker(
  title: string,
  options: PrintingPickerOption[],
  onSelect: (id: string) => void,
  node: React.ReactElement<{ onPress?: () => void; disabled?: boolean }>
) {
  return (
    <PrintingPickerMenu title={title} options={options} onSelect={onSelect}>
      {node}
    </PrintingPickerMenu>
  );
}

/** Tray footer height — Add and stepper must match to avoid grid layout shift. */
const CONTROL_HEIGHT = 'h-9';
const ICON_SIZE = 14;

export function GridCollectionControl({
  owned,
  name,
  busy = false,
  printings,
  fixedVariantNumber,
  simpleAdd = false,
  onAdd,
  onRemove,
}: Props) {
  const pickerOptions = useMemo(
    () => buildPrintingPickerOptions(printings ?? []),
    [printings]
  );

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

  const handleAdd = () => {
    void hapticPress();
    if (fixedVariantNumber) {
      onAdd(fixedVariantNumber);
      return;
    }
    const selection = resolveQuickAddSelection(printings);
    if (!selection) return;
    onAdd(printingSelectionId(selection));
  };

  const handleRemove = () => {
    void hapticPress();
    const selection = resolveQuickRemoveSelection(printings, fixedVariantNumber);
    if (!selection) return;
    onRemove(printingSelectionId(selection));
  };

  if (owned === 0) {
    const addBtn = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${name} to collection`}
        className={cn(
          CONTROL_HEIGHT,
          'w-full flex-row items-center justify-center gap-1.5 rounded-[3px] active:opacity-80',
          OPERATE_CTA_FILL_CLASS,
          busy && 'opacity-60'
        )}
        onPress={showAddPicker ? undefined : handleAdd}
        disabled={busy}
      >
        {busy && !showAddPicker ? (
          <ActivityIndicator size="small" className={OPERATE_CTA_SPINNER_CLASS} />
        ) : (
          <>
            <PlusIcon
              className={cn('size-3.5', OPERATE_CTA_ICON_CLASS)}
              weight="bold"
            />
            <Text className={OPERATE_CTA_LABEL_CLASS}>Add</Text>
          </>
        )}
      </Pressable>
    );

    return showAddPicker
      ? wrapWithPicker('Select printing', pickerOptions, onAdd, addBtn)
      : addBtn;
  }

  const decrement = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove one ${name}`}
      hitSlop={6}
      className={cn(
        'size-8 items-center justify-center rounded-[3px] active:bg-foreground/10',
        busy && 'opacity-60'
      )}
      onPress={showRemovePicker ? undefined : handleRemove}
      disabled={busy}
    >
      {busy && !showRemovePicker ? (
        <ActivityIndicator size="small" className="accent-foreground" />
      ) : (
        <ThemedIcon icon={MinusIcon} size={ICON_SIZE} color="foreground" />
      )}
    </Pressable>
  );

  const increment = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add one ${name}`}
      hitSlop={6}
      className={cn(
        'size-8 items-center justify-center rounded-[3px] active:bg-foreground/10',
        busy && 'opacity-60'
      )}
      onPress={showAddPicker ? undefined : handleAdd}
      disabled={busy}
    >
      {busy && !showAddPicker ? (
        <ActivityIndicator size="small" className="accent-foreground" />
      ) : (
        <ThemedIcon icon={PlusIcon} size={ICON_SIZE} color="foreground" />
      )}
    </Pressable>
  );

  return (
    <View
      className={cn(
        CONTROL_HEIGHT,
        'w-full flex-row items-center justify-between rounded-[3px] border border-border bg-card-panel px-0.5',
        busy && 'opacity-60'
      )}
    >
      {showRemovePicker
        ? wrapWithPicker('Remove printing', removeOptions, onRemove, decrement)
        : decrement}
      <Text className={OPERATE_QTY_CLASS}>{owned}</Text>
      {showAddPicker
        ? wrapWithPicker('Add printing', pickerOptions, onAdd, increment)
        : increment}
    </View>
  );
}
