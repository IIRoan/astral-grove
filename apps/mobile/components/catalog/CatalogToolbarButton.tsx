import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from '@/components/icons';
import { ThemedIcon } from '@/components/icons';
import { Text } from '@/components/ui/text';
import {
  catalogToolbarButtonClasses,
  catalogToolbarIconColor,
} from '@/constants/catalogToolbar';
import { cn } from '@/lib/utils';

interface CatalogToolbarButtonProps {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  label?: string;
  badge?: ReactNode;
  mobile?: boolean;
  className?: string;
}

export function CatalogToolbarButton({
  icon,
  onPress,
  accessibilityLabel,
  active = false,
  label,
  badge,
  mobile = false,
  className,
}: CatalogToolbarButtonProps) {
  const tone = active ? 'active' : 'inactive';

  if (label) {
    return (
      <Pressable
        className={cn(
          catalogToolbarButtonClasses(active, mobile, true),
          'min-w-0 shrink-0 flex-row gap-1.5',
          className
        )}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
      >
        <ThemedIcon
          icon={icon}
          size={mobile ? 18 : 16}
          color={catalogToolbarIconColor(tone)}
        />
        <Text
          className={cn(
            'shrink text-[13px] font-normal leading-none',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
        {badge}
      </Pressable>
    );
  }

  return (
    <Pressable
      className={cn(
        catalogToolbarButtonClasses(active, mobile),
        'relative shrink-0',
        className
      )}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    >
      <ThemedIcon icon={icon} size={18} color={catalogToolbarIconColor(tone)} />
      {badge}
    </Pressable>
  );
}

export function CatalogToolbarBadgeDot() {
  return (
    <View className="absolute right-2 top-2 size-1.5 rounded-full bg-foreground" />
  );
}
