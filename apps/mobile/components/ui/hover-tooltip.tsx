import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { Portal } from '@/components/ui/portal';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import { toolbarIconSize } from '@/components/ui/hover-tooltip.constants';

const EDGE_PAD = 8;
const GAP = 10;
const SHOW_DELAY_MS = 500;
const TOOLBAR_ICON_SIZE = toolbarIconSize;

type Anchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TooltipPlacement = 'top' | 'right' | 'left';

type HoverTooltipProps = {
  label: string;
  description?: string;
  side?: 'top' | 'right';
  children: ReactElement;
  className?: string;
};

function estimateTooltipSize(hasDescription: boolean): {
  width: number;
  height: number;
} {
  return {
    width: hasDescription ? 208 : 112,
    height: hasDescription ? 48 : 28,
  };
}

function TooltipArrow({
  placement,
  color,
}: {
  placement: TooltipPlacement;
  color: string;
}) {
  const base = {
    position: 'absolute' as const,
    width: 8,
    height: 8,
    backgroundColor: color,
    transform: [{ rotate: '45deg' }],
  };

  if (placement === 'right') {
    return (
      <View
        pointerEvents="none"
        style={{
          ...base,
          left: -4,
          top: '50%',
          marginTop: -4,
        }}
      />
    );
  }

  if (placement === 'left') {
    return (
      <View
        pointerEvents="none"
        style={{
          ...base,
          right: -4,
          top: '50%',
          marginTop: -4,
        }}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        ...base,
        bottom: -4,
        left: '50%',
        marginLeft: -4,
      }}
    />
  );
}

/** Web-only portaled hover label (overflow-safe); native returns children only. */
export function HoverTooltip({
  label,
  description,
  side = 'top',
  children,
  className,
}: HoverTooltipProps) {
  const portalName = useId();
  const anchorRef = useRef<View>(null);
  const hoveringRef = useRef(false);
  const sessionRef = useRef(0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [entered, setEntered] = useState(false);
  const cardColor = useCSSVariable('--color-card') as string;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const clearDelay = useCallback(() => {
    if (delayTimerRef.current != null) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    hoveringRef.current = false;
    sessionRef.current += 1;
    clearDelay();
    setEntered(false);
    setAnchor(null);
  }, [clearDelay]);

  const revealAtAnchor = useCallback(() => {
    const session = sessionRef.current;
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (!hoveringRef.current || session !== sessionRef.current) return;
      setAnchor({ x, y, width, height });
      // Next frame so opacity transition can run from 0 → 1
      requestAnimationFrame(() => {
        if (hoveringRef.current && session === sessionRef.current) {
          setEntered(true);
        }
      });
    });
  }, []);

  const scheduleShow = useCallback(() => {
    hoveringRef.current = true;
    sessionRef.current += 1;
    clearDelay();
    delayTimerRef.current = setTimeout(() => {
      delayTimerRef.current = null;
      if (!hoveringRef.current) return;
      revealAtAnchor();
    }, SHOW_DELAY_MS);
  }, [clearDelay, revealAtAnchor]);

  useEffect(() => {
    return () => {
      hide();
    };
  }, [hide]);

  useEffect(() => {
    if (!anchor || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onScroll = () => {
      hide();
    };
    const onBlur = () => {
      hide();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') hide();
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [anchor, hide]);

  if (Platform.OS !== 'web') {
    return children;
  }

  const tip = estimateTooltipSize(Boolean(description));
  let left = 0;
  let top = 0;
  let placement: TooltipPlacement = side;
  if (anchor) {
    if (side === 'right') {
      const preferRight = anchor.x + anchor.width + GAP;
      const fitsRight = preferRight + tip.width <= windowWidth - EDGE_PAD;
      left = fitsRight ? preferRight : Math.max(EDGE_PAD, anchor.x - tip.width - GAP);
      placement = fitsRight ? 'right' : 'left';
      top = Math.max(
        EDGE_PAD,
        Math.min(
          anchor.y + anchor.height / 2 - tip.height / 2,
          windowHeight - tip.height - EDGE_PAD
        )
      );
    } else {
      left = Math.max(
        EDGE_PAD,
        Math.min(
          anchor.x + anchor.width / 2 - tip.width / 2,
          windowWidth - tip.width - EDGE_PAD
        )
      );
      top = Math.max(EDGE_PAD, anchor.y - tip.height - GAP);
      placement = 'top';
    }
  }

  return (
    <View
      ref={anchorRef}
      className={cn('relative', className)}
      {...({
        onMouseEnter: scheduleShow,
        onMouseLeave: hide,
        onPointerEnter: scheduleShow,
        onPointerLeave: hide,
      } as object)}
    >
      {children}
      {anchor ? (
        <Portal name={`hover-tooltip-${portalName}`}>
          <View
            pointerEvents="none"
            style={
              {
                position: 'fixed',
                left,
                top,
                zIndex: 100,
                maxWidth: Math.min(220, windowWidth - EDGE_PAD * 2),
                opacity: entered ? 1 : 0,
                transform: entered ? [{ scale: 1 }] : [{ scale: 0.96 }],
                // RN web maps this to CSS transition
                transitionProperty: 'opacity, transform',
                transitionDuration: '120ms',
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              } as object
            }
          >
            <View className="relative rounded-md border border-border bg-card px-3 py-1.5">
              <TooltipArrow placement={placement} color={cardColor} />
              <Text className="text-xs font-medium text-foreground">{label}</Text>
              {description ? (
                <Text className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

export function ToolbarIconSlot({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn('items-center justify-center overflow-hidden', className)}
      style={{ width: TOOLBAR_ICON_SIZE, height: TOOLBAR_ICON_SIZE }}
    >
      {children}
    </View>
  );
}
