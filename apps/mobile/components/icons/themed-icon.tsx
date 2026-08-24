import type { IconWeight } from 'phosphor-react-native';
import { useCSSVariable } from 'uniwind';
import type { AppIcon } from '@/components/icons/styled-icon.types';
import { appIconWeightForSize, iconPixelSize } from '@/lib/iconDefaults';
import { THEME_ICON_COLOR_VARS, type ThemedIconColor } from '@/lib/themeIconTokens';

export type { ThemedIconColor } from '@/lib/themeIconTokens';

export type ThemedIconProps = {
  icon: AppIcon;
  size: number;
  color?: ThemedIconColor;
  weight?: IconWeight;
};

/** Phosphor tinted by runtime Uniwind token (tab bars / active states). */
export function ThemedIcon({
  icon: Icon,
  size,
  color = 'muted-foreground',
  weight,
}: ThemedIconProps) {
  const resolved = useCSSVariable(THEME_ICON_COLOR_VARS[color]) as string | undefined;
  const pixelSize = iconPixelSize(size);
  return (
    <Icon
      size={pixelSize}
      color={String(resolved ?? '')}
      weight={weight ?? appIconWeightForSize(pixelSize)}
    />
  );
}
