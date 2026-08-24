import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ThemedIcon,
} from '@/components/icons';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ScrollView as ScrollViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Popover, PopoverContent, PopoverPortal } from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import {
  CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS,
  CATALOG_TOOLBAR_EMBEDDED_TRIGGER_ACTIVE_CLASS,
  CATALOG_TOOLBAR_EMBEDDED_TRIGGER_CLASS,
  CATALOG_TOOLBAR_LABELED_CONTROL_CLASS,
  FILTER_OPTION_CHIP_ACTIVE_CLASS,
  FILTER_OPTION_CHIP_ACTIVE_TEXT_CLASS,
  FILTER_OPTION_CHIP_CLASS,
  FILTER_OPTION_CHIP_IDLE_CLASS,
  FILTER_OPTION_CHIP_IDLE_TEXT_CLASS,
} from '@/constants/catalogToolbar';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { cn } from '@/lib/utils';

export function FilterToggleRow({
  label,
  subtitle,
  active,
  onPress,
  leading,
  compact = false,
}: {
  label: string;
  subtitle?: string;
  active: boolean;
  onPress: () => void;
  leading?: ReactNode;
  compact?: boolean;
}) {
  return (
    <Pressable
      className={cn(
        'flex-row items-center justify-between active:opacity-90',
        FACTORY_RADIUS_CONTROL_CLASS,
        compact ? 'min-h-10 px-2 py-2' : 'min-h-12 px-3 py-2.5',
        active ? 'bg-foreground/8' : 'bg-transparent'
      )}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      // RN web does not always map accessibilityState.checked → aria-checked.
      {...(Platform.OS === 'web' ? { 'aria-checked': active } : null)}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5 pr-3">
        {leading}
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-normal text-foreground">{label}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {active ? (
        <View
          className={cn(
            'size-5 items-center justify-center border border-border bg-card-panel',
            FACTORY_RADIUS_CONTROL_CLASS
          )}
        >
          <CheckIcon className="size-3.5 text-foreground" weight="bold" />
        </View>
      ) : (
        <View
          className={cn('size-5 border border-border', FACTORY_RADIUS_CONTROL_CLASS)}
        />
      )}
    </Pressable>
  );
}

export function FilterStatChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={cn(
        FILTER_OPTION_CHIP_CLASS,
        'min-w-[44px] justify-center px-3',
        active ? FILTER_OPTION_CHIP_ACTIVE_CLASS : FILTER_OPTION_CHIP_IDLE_CLASS
      )}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={cn(
          'font-mono text-sm',
          active
            ? FILTER_OPTION_CHIP_ACTIVE_TEXT_CLASS
            : FILTER_OPTION_CHIP_IDLE_TEXT_CLASS
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type TriggerPosition = {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

export type FilterPopoverBarItem<T extends string> = {
  id: T;
  label: string;
  hasValue: boolean;
  children: ReactNode;
  contentClassName?: string;
  maxHeight?: number;
};

function FilterPopoverTrigger({
  label,
  hasValue,
  open,
  onPress,
  triggerRef,
  embedded = false,
}: {
  label: string;
  hasValue: boolean;
  open: boolean;
  onPress: () => void;
  triggerRef: (node: View | null) => void;
  embedded?: boolean;
}) {
  const active = open || hasValue;

  return (
    <Pressable
      ref={triggerRef}
      className={cn(
        embedded
          ? CATALOG_TOOLBAR_EMBEDDED_TRIGGER_CLASS
          : cn(CATALOG_TOOLBAR_LABELED_CONTROL_CLASS, 'relative active:opacity-90'),
        embedded
          ? active && CATALOG_TOOLBAR_EMBEDDED_TRIGGER_ACTIVE_CLASS
          : active && CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS
      )}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <Text
        className={cn(
          'text-[13px] font-normal leading-none',
          open || hasValue ? 'text-foreground' : 'text-muted-foreground'
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      <ThemedIcon
        icon={open ? ChevronUpIcon : ChevronDownIcon}
        size={12}
        color={open || hasValue ? 'foreground' : 'muted-foreground'}
      />
      {hasValue && !open ? (
        <View className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-foreground" />
      ) : null}
    </Pressable>
  );
}

/** One shared popover for a filter bar so sibling triggers stay clickable while switching menus. */
export function FilterPopoverBar<T extends string>({
  portalName,
  openId,
  onOpenIdChange,
  segments,
  embedded = false,
}: {
  portalName: string;
  openId: T | null;
  onOpenIdChange: (id: T | null) => void;
  segments: FilterPopoverBarItem<T>[];
  embedded?: boolean;
}) {
  const triggerRefs = useRef<Partial<Record<T, View | null>>>({});
  const contentRef = useRef<ScrollViewType | null>(null);
  const [triggerPosition, setTriggerPosition] = useState<TriggerPosition>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const viewportMaxHeight = Math.max(
    160,
    windowHeight - insets.top - insets.bottom - 96
  );
  const activeSegment = segments.find((segment) => segment.id === openId);

  const handleTriggerPress = useCallback(
    (id: T) => {
      const node = triggerRefs.current[id];
      if (!node) return;

      node.measure((_x, _y, width, height, pageX, pageY) => {
        setTriggerPosition({ pageX, pageY, width, height });
        onOpenIdChange(openId === id ? null : id);
      });
    },
    [onOpenIdChange, openId]
  );

  const effectiveMaxHeight = activeSegment
    ? Math.min(activeSegment.maxHeight ?? 420, viewportMaxHeight)
    : viewportMaxHeight;

  useEffect(() => {
    if (!openId || Platform.OS !== 'web') return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const clickedTrigger = Object.values(triggerRefs.current).some((node) => {
        const element = node as unknown as {
          contains?: (child: Node) => boolean;
        } | null;
        return element?.contains?.(target) ?? false;
      });
      if (clickedTrigger) return;

      const contentNode = contentRef.current as unknown as {
        contains?: (child: Node) => boolean;
      } | null;
      if (contentNode?.contains?.(target)) return;

      onOpenIdChange(null);
      setTriggerPosition(undefined);
    };

    const frame = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown, true);
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [openId, onOpenIdChange]);

  return (
    <>
      {segments.map((segment) => (
        <FilterPopoverTrigger
          key={segment.id}
          label={segment.label}
          hasValue={segment.hasValue}
          open={openId === segment.id}
          onPress={() => handleTriggerPress(segment.id)}
          triggerRef={(node) => {
            triggerRefs.current[segment.id] = node;
          }}
          embedded={embedded}
        />
      ))}

      <Popover
        open={openId !== null}
        switchKey={openId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onOpenIdChange(null);
            setTriggerPosition(undefined);
          }
        }}
        triggerPosition={triggerPosition}
        onTriggerPositionChange={setTriggerPosition}
      >
        <PopoverPortal name={portalName}>
          {activeSegment ? (
            <PopoverContent
              className={cn(
                'overflow-hidden border border-border bg-card-panel p-0 shadow-none',
                FACTORY_RADIUS_CONTROL_CLASS,
                activeSegment.contentClassName
              )}
              side="bottom"
              align="start"
              width={280}
              style={{ maxHeight: effectiveMaxHeight }}
            >
              <ScrollView
                ref={contentRef}
                style={{ maxHeight: effectiveMaxHeight }}
                contentContainerClassName="p-1.5"
                contentContainerStyle={{ flexGrow: 0 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                {activeSegment.children}
              </ScrollView>
            </PopoverContent>
          ) : null}
        </PopoverPortal>
      </Popover>
    </>
  );
}

export function FilterClearButton({
  onPress,
  label = 'Clear all',
  embedded = false,
}: {
  onPress: () => void;
  label?: string;
  embedded?: boolean;
}) {
  return (
    <Pressable
      className={cn(
        embedded
          ? cn(
              CATALOG_TOOLBAR_EMBEDDED_TRIGGER_CLASS,
              'items-center justify-center px-2.5'
            )
          : cn(
              'h-10 shrink-0 items-center justify-center px-2 active:opacity-80',
              FACTORY_RADIUS_CONTROL_CLASS
            )
      )}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text className="text-[13px] font-normal text-foreground">{label}</Text>
    </Pressable>
  );
}
