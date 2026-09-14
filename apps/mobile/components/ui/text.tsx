import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { textFontStyleForClassName } from '@/lib/fonts';
import { cn } from '@/lib/utils';

/**
 * Cap Dynamic Type / Android font scale so dense chrome (tiles, toolbars, tab bar)
 * stays legible without clipping. Still honors user scaling up to 140%; callers can override.
 */
export const TEXT_MAX_FONT_SIZE_MULTIPLIER = 1.4;

export const Text = ({
  children,
  className,
  style,
  maxFontSizeMultiplier = TEXT_MAX_FONT_SIZE_MULTIPLIER,
  ...props
}: RNTextProps) => {
  const merged = cn('font-sans font-normal text-base text-foreground', className);

  return (
    <RNText
      className={merged}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[textFontStyleForClassName(merged), style]}
      {...props}
    >
      {children}
    </RNText>
  );
};
