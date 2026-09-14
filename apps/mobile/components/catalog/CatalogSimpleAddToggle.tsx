import { LightningIcon, ThemedIcon } from '@/components/icons';
import { Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import {
  catalogToolbarButtonClasses,
  catalogToolbarIconColor,
} from '@/constants/catalogToolbar';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface CatalogSimpleAddToggleProps {
  active: boolean;
  onChange: (active: boolean) => void;
  /**
   * Force icon-only (`true`) or labeled (`false`).
   * When omitted, phones are icon-only and desktop shows the label.
   */
  iconOnly?: boolean;
  className?: string;
}

export function CatalogSimpleAddToggle({
  active,
  onChange,
  iconOnly,
  className,
}: CatalogSimpleAddToggleProps) {
  const isMobile = useMobileLayout();
  // Explicit iconOnly wins; otherwise phones default to icon-only, desktop shows the label.
  const hideLabel = iconOnly ?? isMobile;
  const tone = active ? 'active' : 'inactive';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel="Quick add"
      accessibilityHint="Skip foil choice and add the standard printing"
      onPress={() => {
        void hapticPress();
        onChange(!active);
      }}
      className={cn(
        catalogToolbarButtonClasses(active, isMobile, !hideLabel),
        hideLabel && (isMobile ? 'w-11 px-0' : 'w-10 px-0'),
        className
      )}
    >
      <ThemedIcon
        icon={LightningIcon}
        size={isMobile ? 18 : 16}
        color={catalogToolbarIconColor(tone)}
      />
      {hideLabel ? null : (
        <Text
          className={cn(
            'text-[13px] font-normal leading-none',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
          numberOfLines={1}
        >
          Quick add
        </Text>
      )}
    </Pressable>
  );
}
