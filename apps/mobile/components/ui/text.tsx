import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { textFontStyleForClassName } from '@/lib/fonts';
import { cn } from '@/lib/utils';

export const Text = ({ children, className, style, ...props }: RNTextProps) => {
  const merged = cn('font-sans font-normal text-base text-foreground', className);

  return (
    <RNText
      className={merged}
      style={[textFontStyleForClassName(merged), style]}
      {...props}
    >
      {children}
    </RNText>
  );
};
