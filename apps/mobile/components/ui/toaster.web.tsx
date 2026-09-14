import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import { mobileTabBarVisible, toastBottomOffset } from '@/lib/mobile-chrome';

export const Toaster = (props: Omit<ToasterProps, 'theme'>) => {
  const { theme: uniwindTheme } = useUniwind();
  const theme = uniwindTheme === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const showRail = useShowSideRail();
  // Sonner switches to full-width bottom toasts below 600px — keep them above the tab bar.
  const mobileBottom = toastBottomOffset(
    insets.bottom,
    mobileTabBarVisible(pathname, showRail)
  );

  return (
    <SonnerToaster
      closeButton
      duration={3_500}
      gap={8}
      offset={12}
      mobileOffset={{ bottom: mobileBottom, left: 16, right: 16 }}
      position="bottom-right"
      visibleToasts={3}
      toastOptions={{
        classNames: {
          content: 'gap-3',
          description: 'text-muted-foreground text-[13px] leading-snug',
          toast:
            'w-auto max-w-sm rounded-xl border border-border bg-card px-3.5 py-3 shadow-lg shadow-black/25',
          title: 'text-sm font-medium leading-5 text-foreground',
        },
      }}
      {...props}
      theme={theme}
    />
  );
};
