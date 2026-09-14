import { cva } from 'class-variance-authority';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import { Easing, FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import { mobileTabBarVisible, toastBottomOffset } from '@/lib/mobile-chrome';
import { MOTION } from '@/lib/motion';
import { useCSSVariable, useUniwind } from 'uniwind';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from '@/components/icons';
import { Toaster as SonnerToaster, type ToasterProps } from '@/lib/sonner';

const TOAST_MAX_WIDTH = 384;
const TOAST_SIDE_GUTTER = 16;

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';

const ToastGlyphIcon = ({ variant }: { variant: ToastVariant }) => {
  const className = iconVariants({ variant });

  if (variant === 'success') {
    return <CircleCheckIcon className={className} weight="bold" />;
  }

  if (variant === 'error') {
    return <TriangleAlertIcon className={className} weight="bold" />;
  }

  if (variant === 'warning') {
    return <CircleAlertIcon className={className} weight="bold" />;
  }

  return <InfoIcon className={className} weight="bold" />;
};

const ToastIcon = ({ variant }: { variant: ToastVariant }) => (
  <View className="size-7 shrink-0 items-center justify-center rounded-lg bg-card-panel">
    {variant === 'loading' ? (
      <ActivityIndicator className="accent-muted-foreground" size="small" />
    ) : (
      <ToastGlyphIcon variant={variant} />
    )}
  </View>
);

export const Toaster = (props: Omit<ToasterProps, 'theme'>) => {
  const { theme: uniwindTheme } = useUniwind();
  const theme = uniwindTheme === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pathname = usePathname();
  const showRail = useShowSideRail();
  const bottomOffset = toastBottomOffset(
    insets.bottom,
    mobileTabBarVisible(pathname, showRail)
  );
  const [card, border, foreground, mutedForeground] = useCSSVariable([
    '--color-card',
    '--color-border',
    '--color-foreground',
    '--color-muted-foreground',
  ]) as string[];

  return (
    <SonnerToaster
      duration={3_500}
      enableStacking
      gap={8}
      offset={bottomOffset}
      position="bottom-center"
      swipeToDismissDirection="up"
      visibleToasts={3}
      animation={{
        enter: FadeInUp.springify()
          .damping(MOTION.snappy.damping)
          .stiffness(MOTION.snappy.stiffness)
          .mass(MOTION.snappy.mass),
        exit: FadeOutDown.duration(200).easing(Easing.in(Easing.cubic)),
      }}
      icons={{
        error: <ToastIcon variant="error" />,
        info: <ToastIcon variant="info" />,
        loading: <ToastIcon variant="loading" />,
        success: <ToastIcon variant="success" />,
        warning: <ToastIcon variant="warning" />,
      }}
      toastOptions={{
        style: {
          alignSelf: 'center',
          backgroundColor: card,
          borderColor: border,
          borderCurve: 'continuous',
          borderRadius: 12,
          borderWidth: 1,
          elevation: 8,
          // Explicit width: sonner-native adds marginHorizontal 16, so '100%' overflowed phones.
          marginHorizontal: 0,
          width: Math.min(TOAST_MAX_WIDTH, windowWidth - TOAST_SIDE_GUTTER * 2),
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: '#000',
          shadowOffset: { height: 4, width: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        descriptionStyle: {
          color: mutedForeground,
          fontSize: 13,
          lineHeight: 18,
        },
        titleStyle: {
          color: foreground,
          fontSize: 14,
          fontWeight: '500',
          lineHeight: 20,
        },
        toastContentStyle: {
          alignItems: 'center',
          gap: 12,
        },
      }}
      {...props}
      theme={theme}
    />
  );
};

const iconVariants = cva('size-4', {
  variants: {
    variant: {
      default: 'text-muted-foreground',
      error: 'text-destructive',
      info: 'text-archive-accent-text',
      loading: 'text-muted-foreground',
      success: 'text-success',
      warning: 'text-warning',
    },
  },
});
