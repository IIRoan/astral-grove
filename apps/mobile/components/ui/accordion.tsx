import type { ComponentPropsWithRef, ComponentRef, ReactNode } from 'react';
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  View,
  type ViewProps,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { cn, mergeRefs } from '@/lib/utils';
import { DISCLOSURE_MOTION } from '@/lib/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { ChevronDownIcon } from '@/components/icons';
import { Slot } from './slot';

const CONTENT_ENTER = FadeInDown.springify().damping(28).stiffness(340).mass(0.55);
const CONTENT_EXIT = FadeOutUp.duration(120).damping(32).stiffness(380);
const ITEM_LAYOUT = LinearTransition.springify().damping(28).stiffness(340).mass(0.6);
const ICON_SPRING = { damping: 26, stiffness: 320, mass: 0.5 };

const ACCORDION_ITEM_CLASSNAME = cn(
  'my-0 overflow-hidden rounded-none bg-card',
  'data-[layout=open]:my-2 data-[layout=open]:rounded-2xl',
  'data-[layout=closed-only]:rounded-2xl',
  'data-[layout=closed-start]:rounded-t-2xl',
  'data-[layout=closed-end]:rounded-b-2xl'
);

const AnimatedView = Animated.createAnimatedComponent(View);

type AccordionType = 'single' | 'multiple';

type AccordionItemLayout =
  'open' | 'closed-only' | 'closed-start' | 'closed-middle' | 'closed-end';

type AccordionRootContextValue = {
  type: AccordionType;
  collapsible: boolean;
  itemLayouts: Record<string, AccordionItemLayout>;
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
  deferredMotion: boolean;
  reduceMotion: boolean;
};

type AccordionItemContextValue = {
  value: string;
  isOpen: boolean;
  contentId: string;
  triggerId: string;
};

const AccordionRootContext = createContext<AccordionRootContextValue | null>(null);
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

const useAccordionRoot = () => {
  const ctx = useContext(AccordionRootContext);
  if (!ctx) {
    throw new Error('Accordion components must be used within Accordion');
  }
  return ctx;
};

const useAccordionItem = () => {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) {
    throw new Error(
      'AccordionItem, AccordionTrigger, AccordionContent, and AccordionIndicator must be used within AccordionItem'
    );
  }
  return ctx;
};

const getAccordionItemValues = (children: ReactNode): string[] => {
  const values: string[] = [];

  Children.forEach(children, (child) => {
    if (
      isValidElement<{ value?: string }>(child) &&
      typeof child.props.value === 'string'
    ) {
      values.push(child.props.value);
    }
  });

  return values;
};

const getClosedItemLayout = (
  index: number,
  itemValues: string[],
  isItemOpen: (value: string) => boolean
): AccordionItemLayout => {
  const prevOpen = index === 0 || isItemOpen(itemValues[index - 1] ?? '');
  const nextOpen =
    index === itemValues.length - 1 || isItemOpen(itemValues[index + 1] ?? '');

  if (prevOpen && nextOpen) {
    return 'closed-only';
  }
  if (prevOpen) {
    return 'closed-start';
  }
  if (nextOpen) {
    return 'closed-end';
  }
  return 'closed-middle';
};

export type AccordionProps = {
  type?: AccordionType;
  collapsible?: boolean;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[] | undefined) => void;
  children: ReactNode;
  animation?: 'default' | 'deferred';
};

export const Accordion = ({
  type = 'single',
  collapsible = false,
  value: valueProp,
  defaultValue,
  onValueChange,
  children,
  animation = 'default',
}: AccordionProps) => {
  const deferredMotion = Platform.OS === 'web' && animation === 'deferred';
  const reduceMotion = useReduceMotion();
  const itemValues = useMemo(() => getAccordionItemValues(children), [children]);
  const isControlled = valueProp !== undefined;

  const [internalSingle, setInternalSingle] = useState<string | undefined>(
    typeof defaultValue === 'string' ? defaultValue : undefined
  );
  const [internalMultiple, setInternalMultiple] = useState<string[]>(
    Array.isArray(defaultValue) ? defaultValue : []
  );

  const singleValue = isControlled
    ? typeof valueProp === 'string'
      ? valueProp
      : undefined
    : internalSingle;

  const multipleValues = useMemo(() => {
    if (type !== 'multiple') {
      return new Set<string>();
    }
    if (isControlled) {
      return new Set(Array.isArray(valueProp) ? valueProp : []);
    }
    return new Set(internalMultiple);
  }, [type, isControlled, valueProp, internalMultiple]);

  const isOpen = useCallback(
    (itemValue: string) => {
      if (type === 'multiple') {
        return multipleValues.has(itemValue);
      }
      return singleValue === itemValue;
    },
    [type, singleValue, multipleValues]
  );

  const itemLayouts = useMemo(() => {
    const layouts: Record<string, AccordionItemLayout> = {};

    for (let index = 0; index < itemValues.length; index++) {
      const itemValue = itemValues[index] ?? '';

      layouts[itemValue] = isOpen(itemValue)
        ? 'open'
        : getClosedItemLayout(index, itemValues, isOpen);
    }

    return layouts;
  }, [itemValues, isOpen]);

  const toggle = useCallback(
    (itemValue: string) => {
      if (type === 'multiple') {
        const next = new Set(multipleValues);
        if (next.has(itemValue)) {
          next.delete(itemValue);
        } else {
          next.add(itemValue);
        }
        const arr = [...next];
        if (!isControlled) {
          setInternalMultiple(arr);
        }
        onValueChange?.(arr);
        return;
      }

      let next: string | undefined;
      if (singleValue === itemValue) {
        next = collapsible ? undefined : itemValue;
      } else {
        next = itemValue;
      }
      if (!isControlled) {
        setInternalSingle(next);
      }
      onValueChange?.(next);
    },
    [type, multipleValues, singleValue, collapsible, isControlled, onValueChange]
  );

  const ctx = useMemo(
    () => ({
      type,
      collapsible,
      itemLayouts,
      isOpen,
      toggle,
      deferredMotion,
      reduceMotion,
    }),
    [type, collapsible, itemLayouts, isOpen, toggle, deferredMotion, reduceMotion]
  );

  return (
    <AccordionRootContext.Provider value={ctx}>
      {children}
    </AccordionRootContext.Provider>
  );
};

export type AccordionItemProps = ViewProps & {
  value: string;
  children: ReactNode;
};

export const AccordionItem = ({
  value,
  className,
  children,
  ...props
}: AccordionItemProps) => {
  const root = useAccordionRoot();
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const contentId = `${baseId}-content`;
  const open = root.isOpen(value);
  const layout = root.itemLayouts[value] ?? 'closed-only';
  const Comp = root.deferredMotion ? View : AnimatedView;

  const itemCtx = useMemo(
    () => ({
      value,
      isOpen: open,
      contentId,
      triggerId,
    }),
    [value, open, contentId, triggerId]
  );

  return (
    <AccordionItemContext.Provider value={itemCtx}>
      <Comp
        className={cn(ACCORDION_ITEM_CLASSNAME, className)}
        data-layout={layout}
        {...(root.deferredMotion ? null : { layout: ITEM_LAYOUT })}
        {...props}
      >
        {children}
      </Comp>
    </AccordionItemContext.Provider>
  );
};

export type AccordionTriggerProps = Omit<
  ComponentPropsWithRef<typeof Pressable>,
  'children'
> & {
  asChild?: boolean;
  children?: ReactNode;
};

export const AccordionTrigger = ({
  asChild,
  children,
  className,
  onPress,
  ref: refProp,
  ...props
}: AccordionTriggerProps) => {
  const root = useAccordionRoot();
  const item = useAccordionItem();
  const ref = useRef<ComponentRef<typeof Pressable>>(null);
  const mergedRefs = mergeRefs(ref, refProp);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      onPress?.(e);
      root.toggle(item.value);
    },
    [onPress, root, item.value]
  );

  const Comp = asChild ? Slot.Pressable : Pressable;

  return (
    <Comp
      accessibilityRole="button"
      accessibilityState={{ expanded: item.isOpen }}
      {...(Platform.OS === 'web' ? { 'aria-expanded': item.isOpen } : null)}
      className={cn(
        'flex flex-row items-center justify-between gap-2 bg-card px-3 py-3 active:opacity-75',
        className
      )}
      nativeID={item.triggerId}
      onPress={handlePress}
      ref={mergedRefs}
      {...props}
    >
      {children}
    </Comp>
  );
};

export type AccordionContentProps = ViewProps & {
  children: ReactNode;
};

function DeferredAccordionContent({
  children,
  className,
  ...props
}: AccordionContentProps) {
  const { isOpen, contentId } = useAccordionItem();
  const { reduceMotion } = useAccordionRoot();
  const [present, setPresent] = useState(isOpen);
  const [measured, setMeasured] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    let prepareFrame = 0;
    let revealFrame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setInteractive(false);
    if (reduceMotion) {
      setPresent(isOpen);
      setRevealed(isOpen);
      setInteractive(isOpen);
    } else if (isOpen) {
      setPresent(true);
      if (measured) {
        // Paint the measured, hidden rows before starting their reveal.
        prepareFrame = requestAnimationFrame(() => {
          revealFrame = requestAnimationFrame(() => {
            setRevealed(true);
            timer = setTimeout(
              () => setInteractive(true),
              DISCLOSURE_MOTION.enterDelayMs + DISCLOSURE_MOTION.enterMs
            );
          });
        });
      }
    } else {
      setRevealed(false);
      timer = setTimeout(() => {
        setPresent(false);
        setMeasured(false);
      }, DISCLOSURE_MOTION.exitMs);
    }

    return () => {
      cancelAnimationFrame(prepareFrame);
      cancelAnimationFrame(revealFrame);
      clearTimeout(timer);
    };
  }, [isOpen, measured, reduceMotion]);

  if (reduceMotion ? !isOpen : !present) return null;

  const visible = isOpen && (reduceMotion || revealed);
  const enabled = isOpen && (reduceMotion || interactive);

  return (
    <View
      nativeID={contentId}
      testID="accordion-deferred-content"
      aria-hidden={!enabled}
      {...{ inert: !enabled }}
      pointerEvents={enabled ? 'auto' : 'none'}
      onLayout={() => setMeasured(true)}
      style={{
        opacity: visible ? 1 : 0,
        transform: [{ translateY: visible || reduceMotion ? 0 : 4 }],
        transitionProperty: 'opacity, transform',
        transitionDuration: reduceMotion
          ? '0ms'
          : `${visible ? DISCLOSURE_MOTION.enterMs : DISCLOSURE_MOTION.exitMs}ms`,
        transitionDelay:
          visible && !reduceMotion ? `${DISCLOSURE_MOTION.enterDelayMs}ms` : '0ms',
        transitionTimingFunction: DISCLOSURE_MOTION.easing,
      }}
    >
      <View className={cn('px-3 pt-1 pb-3', className)} {...props}>
        {children}
      </View>
    </View>
  );
}

export const AccordionContent = ({
  children,
  className,
  ...props
}: AccordionContentProps) => {
  const item = useAccordionItem();
  const root = useAccordionRoot();

  if (root.deferredMotion) {
    return (
      <DeferredAccordionContent className={className} {...props}>
        {children}
      </DeferredAccordionContent>
    );
  }

  if (!item.isOpen) {
    return null;
  }

  return (
    <Animated.View
      entering={CONTENT_ENTER}
      exiting={CONTENT_EXIT}
      nativeID={item.contentId}
    >
      <View className={cn('px-3 pt-1 pb-3', className)} {...props}>
        {children}
      </View>
    </Animated.View>
  );
};

export type AccordionIndicatorProps = {
  className?: string;
  children?: ReactNode;
};

export const AccordionIndicator = ({
  className,
  children,
}: AccordionIndicatorProps) => {
  const item = useAccordionItem();
  const root = useAccordionRoot();
  const rotation = useSharedValue(item.isOpen ? 180 : 0);

  useEffect(() => {
    if (root.deferredMotion) return;
    rotation.value = withSpring(item.isOpen ? 180 : 0, ICON_SPRING);
  }, [item.isOpen, rotation, root.deferredMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (root.deferredMotion) {
    return (
      <View
        className="shrink-0"
        style={{
          transform: [{ rotate: item.isOpen ? '180deg' : '0deg' }],
          transitionProperty: 'transform',
          transitionDuration: root.reduceMotion
            ? '0ms'
            : `${DISCLOSURE_MOTION.resizeMs}ms`,
          transitionTimingFunction: DISCLOSURE_MOTION.easing,
        }}
      >
        {children ?? (
          <ChevronDownIcon className={cn('size-5 text-muted-foreground', className)} />
        )}
      </View>
    );
  }

  if (children) {
    return (
      <Animated.View className="shrink-0" style={animatedStyle}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <ChevronDownIcon
        className={cn('size-5 shrink-0 text-muted-foreground', className)}
      />
    </Animated.View>
  );
};
