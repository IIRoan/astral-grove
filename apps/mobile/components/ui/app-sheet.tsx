import { useMemo, type ComponentProps, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetOverlay,
  BottomSheetPortal,
  BottomSheetScrollView,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { AppSheetContext, useAppSheetContext } from '@/components/ui/app-sheet.hooks';
import { Button, ButtonIcon } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { XIcon } from '@/components/icons';
import { Portal, PortalOverlay } from '@/components/ui/portal';
import { useOverlayPresence } from '@/hooks/useOverlayPresence';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import { OVERLAY } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { AppSheetContextValue } from '@/components/ui/app-sheet.hooks';

type AppSheetMode = AppSheetContextValue['mode'];

interface AppSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** When false, overlay / close cannot dismiss (e.g. while busy). */
  dismissible?: boolean;
}

/** Overlay shell: mobile bottom sheet, desktop centered dialog (matched chrome). */
export function AppSheet({
  open,
  onOpenChange,
  children,
  dismissible = true,
}: AppSheetProps) {
  const showRail = useShowSideRail();
  const mode: AppSheetMode = showRail ? 'dialog' : 'sheet';
  const { visible, progress, reduceMotion } = useOverlayPresence(
    mode === 'dialog' ? open : false
  );
  // Stay mounted through exit: parent `open` may be false while presence is settling.
  const dialogMounted = mode === 'dialog' && (open || visible);

  const value = useMemo(
    () => ({
      mode,
      open: mode === 'dialog' ? dialogMounted : open,
      onOpenChange,
      dismissible,
      presence: mode === 'dialog' ? progress : null,
      reduceMotion,
    }),
    [dialogMounted, dismissible, mode, onOpenChange, open, progress, reduceMotion]
  );

  if (mode === 'sheet') {
    return (
      <AppSheetContext.Provider value={value}>
        <BottomSheet
          open={open}
          onOpenChange={(next) => {
            if (!next && !dismissible) return;
            onOpenChange(next);
          }}
        >
          {children}
        </BottomSheet>
      </AppSheetContext.Provider>
    );
  }

  if (!dialogMounted) {
    return null;
  }

  return <AppSheetContext.Provider value={value}>{children}</AppSheetContext.Provider>;
}

export function AppSheetPortal({
  name = 'app-sheet',
  children,
}: {
  name?: string;
  children: ReactNode;
}) {
  const ctx = useAppSheetContext();
  const { mode, open, onOpenChange, dismissible, presence } = ctx;

  // Portals render outside the React tree — re-provide context (same as BottomSheetPortal).
  const portaled = (
    <AppSheetContext.Provider value={ctx}>{children}</AppSheetContext.Provider>
  );

  if (mode === 'sheet') {
    return <BottomSheetPortal name={name}>{portaled}</BottomSheetPortal>;
  }

  if (!open || !presence) return null;

  return (
    <Portal name={name}>
      <PortalOverlay>
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => {
            if (dismissible) onOpenChange(false);
          }}
        >
          <View className="flex-1 items-center justify-center px-6 py-8">
            {portaled}
          </View>
        </Modal>
      </PortalOverlay>
    </Portal>
  );
}

export function AppSheetOverlay({ className }: { className?: string }) {
  const { mode, onOpenChange, dismissible, presence, reduceMotion } =
    useAppSheetContext();

  if (mode === 'sheet') {
    return <BottomSheetOverlay className={className} closeOnPress={dismissible} />;
  }

  if (!presence) return null;

  return (
    <AppSheetDialogOverlay
      className={className}
      dismissible={dismissible}
      presence={presence}
      reduceMotion={reduceMotion}
      onDismiss={() => {
        if (dismissible) onOpenChange(false);
      }}
    />
  );
}

function AppSheetDialogOverlay({
  className,
  dismissible,
  presence,
  reduceMotion,
  onDismiss,
}: {
  className?: string;
  dismissible: boolean;
  presence: SharedValue<number>;
  reduceMotion: boolean;
  onDismiss: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      presence.value,
      [0, 1],
      [0, OVERLAY.backdropLight],
      Extrapolation.CLAMP
    );
    return { opacity: reduceMotion ? presence.value * OVERLAY.backdropLight : opacity };
  });

  return (
    <Animated.View
      accessibilityLabel="Dismiss"
      className={cn('absolute inset-0 bg-black', className)}
      style={animatedStyle}
    >
      <Pressable
        accessibilityLabel="Dismiss"
        className="absolute inset-0"
        disabled={!dismissible}
        onPress={onDismiss}
      />
    </Animated.View>
  );
}

type AppSheetContentGestures = {
  panDownToClose?: boolean;
  overDrag?: boolean;
  contentPanning?: boolean;
};

type AppSheetContentProps = ComponentProps<typeof View> & {
  snapPoints?: Array<number | string>;
  defaultSnapIndex?: number;
  gestures?: AppSheetContentGestures;
  bottomInset?: number;
};

export function AppSheetContent({
  children,
  className,
  snapPoints,
  defaultSnapIndex,
  gestures,
  bottomInset,
  ...props
}: AppSheetContentProps) {
  const { mode, dismissible, presence, reduceMotion } = useAppSheetContext();

  if (mode === 'sheet') {
    return (
      <BottomSheetContent
        enableDynamicSizing={snapPoints == null || snapPoints.length === 0}
        enablePanDownToClose={gestures?.panDownToClose ?? dismissible}
        enableOverDrag={gestures?.overDrag}
        enableContentPanningGesture={gestures?.contentPanning}
        snapPoints={snapPoints}
        defaultSnapIndex={defaultSnapIndex}
        bottomInset={bottomInset}
        className={className}
      >
        {children}
      </BottomSheetContent>
    );
  }

  if (!presence) return null;

  return (
    <AppSheetDialogContent
      className={className}
      presence={presence}
      reduceMotion={reduceMotion}
      {...props}
    >
      {children}
    </AppSheetDialogContent>
  );
}

function AppSheetDialogContent({
  children,
  className,
  presence,
  reduceMotion,
  ...props
}: ComponentProps<typeof View> & {
  presence: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: presence.value };
    }

    return {
      opacity: presence.value,
      transform: [
        {
          scale: interpolate(
            presence.value,
            [0, 1],
            [OVERLAY.enterScale, 1],
            Extrapolation.CLAMP
          ),
        },
        {
          translateY: interpolate(
            presence.value,
            [0, 1],
            [OVERLAY.enterY, 0],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      {...props}
      className={cn(
        'z-10 flex max-h-[90%] w-full max-w-md flex-col overflow-hidden rounded-[10px] bg-background',
        className
      )}
      style={animatedStyle}
    >
      {children}
    </Animated.View>
  );
}

export function AppSheetHeader({
  className,
  children,
  ...props
}: ComponentProps<typeof View>) {
  const { mode, onOpenChange, dismissible } = useAppSheetContext();

  if (mode === 'sheet') {
    return (
      <BottomSheetHeader className={className} {...props}>
        {children}
      </BottomSheetHeader>
    );
  }

  return (
    <View
      className={cn('flex flex-row items-center gap-2 bg-background p-4', className)}
      {...props}
    >
      <View className="min-w-0 flex-1">{children}</View>
      <Button
        className="shrink-0"
        size="icon"
        variant="link"
        disabled={!dismissible}
        onPress={() => {
          if (dismissible) onOpenChange(false);
        }}
      >
        <ButtonIcon className="text-foreground">
          <XIcon />
        </ButtonIcon>
      </Button>
    </View>
  );
}

/** Same displayName as BottomSheetHeader so sticky-scroll sheets can extract it. */
AppSheetHeader.displayName = 'BottomSheetHeader';

export function AppSheetTitle({ className, ...props }: ComponentProps<typeof Text>) {
  const { mode } = useAppSheetContext();

  if (mode === 'sheet') {
    return <BottomSheetTitle className={className} {...props} />;
  }

  return (
    <Text
      className={cn('font-semibold text-foreground text-xl leading-tight', className)}
      {...props}
    />
  );
}

export function AppSheetBody({ className, ...props }: ComponentProps<typeof View>) {
  const { mode } = useAppSheetContext();

  if (mode === 'sheet') {
    return <BottomSheetBody className={className} {...props} />;
  }

  return <View className={cn('px-4', className)} {...props} />;
}

export function AppSheetFooter({ className, ...props }: ComponentProps<typeof View>) {
  const { mode } = useAppSheetContext();

  if (mode === 'sheet') {
    return <BottomSheetFooter className={className} {...props} />;
  }

  return (
    <View
      className={cn(
        'mt-auto flex w-full flex-col gap-2 border-border border-t bg-background px-4 pt-4 pb-4',
        className
      )}
      {...props}
    />
  );
}

/** Same displayName as BottomSheetFooter so sheet content splitting stays correct. */
AppSheetFooter.displayName = 'BottomSheetFooter';

type AppSheetScrollViewProps = ComponentProps<typeof BottomSheetScrollView> & {
  className?: string;
  contentContainerClassName?: string;
  headerInset?: number;
};

/** Sheet → Gorhom scroll; dialog → RN ScrollView (avoids useBottomSheetInternal on web). */
export function AppSheetScrollView({
  className,
  contentContainerStyle,
  headerInset = 0,
  style,
  ...props
}: AppSheetScrollViewProps) {
  const { mode } = useAppSheetContext();

  if (mode === 'sheet') {
    return (
      <BottomSheetScrollView
        className={className}
        contentContainerStyle={contentContainerStyle}
        headerInset={headerInset}
        style={style}
        {...props}
      />
    );
  }

  const dialogContentStyle = StyleSheet.flatten([
    { paddingHorizontal: 16, paddingBottom: 16 },
    headerInset > 0 ? { paddingTop: headerInset } : null,
    contentContainerStyle as StyleProp<ViewStyle> | undefined,
  ]);

  // Dialogs size to their content under max-h: flex-1 would collapse to zero height there,
  // so shrink from content size instead (sheets keep flex-1 inside their snap height).
  return (
    <ScrollView
      className={cn('min-h-0 flex-initial', className)}
      contentContainerStyle={dialogContentStyle}
      style={style as StyleProp<ViewStyle> | undefined}
      {...(props as ComponentProps<typeof ScrollView>)}
    />
  );
}

/** Keep sticky-scroll sheet splitting recognizing this as the scroll body. */
AppSheetScrollView.displayName = 'BottomSheetScrollView';
