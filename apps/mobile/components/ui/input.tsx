import { type VariantProps } from 'class-variance-authority';
import {
  Children,
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { Pressable, TextInput as RNTextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import type { ButtonProps } from '@/components/ui/button.types';
import type {
  InputAddonProps,
  InputPressableProps,
  InputProps,
} from '@/components/ui/input.types';
import {
  inputAddonButtonIconVariants,
  inputAddonButtonVariants,
  inputAddonVariants,
} from '@/components/ui/input.variants';
import { DEFAULT_SANS, textFontStyleForClassName } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { Button, ButtonIcon } from './button';

const ANIMATION_DURATION = 120;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type InternalInputAddonButtonContextType = VariantProps<
  typeof inputAddonButtonVariants
> &
  Pick<ButtonProps, 'variant'>;

type InputAddonIconProps = {
  children: React.ReactNode;
  className?: string;
};

type InputAddonButtonProps = Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputAddonButtonVariants>;

const InputAddonButtonContext =
  createContext<InternalInputAddonButtonContextType | null>(null);

const useInputAddonButtonContext = () => {
  const context = useContext(InputAddonButtonContext);
  if (!context) {
    throw new Error(
      'useInputAddonButtonContext must be used within a Button component'
    );
  }
  return context;
};

export const Input = ({ className, disabled, style, ...props }: InputProps) => {
  const merged = cn(
    'grow font-sans font-normal text-base text-foreground leading-tight outline-none focus:outline-none',
    className
  );

  const fontStyle = textFontStyleForClassName(merged);

  return (
    <RNTextInput
      className={merged}
      style={[
        { ...fontStyle, fontFamily: fontStyle.fontFamily ?? DEFAULT_SANS },
        style,
      ]}
      editable={!disabled}
      placeholderTextColorClassName="accent-muted-foreground"
      {...props}
    />
  );
};

export const InputPressable = ({
  children,
  disabled,
  invalid,
  focused,
  bordered = false,
  onPress,
  className,
  ...props
}: InputPressableProps) => {
  const [inputColor, ringColor, destructiveColor] = useCSSVariable([
    '--color-input',
    '--color-ring',
    '--color-destructive',
  ]) as [string, string, string];

  const outlineWidth = useSharedValue(1);
  const outlineColorProgress = useSharedValue(0);

  useEffect(() => {
    if (bordered) return;

    if (invalid) {
      outlineWidth.value = withTiming(2, { duration: ANIMATION_DURATION });
      outlineColorProgress.value = withTiming(2, {
        duration: ANIMATION_DURATION,
      });
    } else if (focused) {
      outlineWidth.value = withTiming(2, { duration: ANIMATION_DURATION });
      outlineColorProgress.value = withTiming(1, {
        duration: ANIMATION_DURATION,
      });
    } else {
      outlineWidth.value = withTiming(1, { duration: ANIMATION_DURATION });
      outlineColorProgress.value = withTiming(0, {
        duration: ANIMATION_DURATION,
      });
    }
  }, [bordered, focused, invalid, outlineWidth, outlineColorProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (bordered) {
      return {};
    }

    const outlineColor = interpolateColor(
      outlineColorProgress.value,
      [0, 1, 2],
      [inputColor, ringColor, destructiveColor]
    );

    return {
      outlineWidth: outlineWidth.value,
      outlineColor,
    };
  });

  return (
    <AnimatedPressable
      {...props}
      accessibilityState={{ disabled }}
      className={cn(
        'flex min-h-12 w-full flex-row items-center gap-2 rounded-[3px] bg-background px-3 py-2 active:bg-card-panel disabled:opacity-50',
        bordered && 'border',
        className,
        bordered && !invalid && !focused && 'border-border',
        bordered && !invalid && focused && 'border-ring/50',
        bordered && invalid && 'border-destructive'
      )}
      disabled={disabled}
      onPress={onPress}
      style={bordered ? undefined : animatedStyle}
    >
      {children}
    </AnimatedPressable>
  );
};

export const InputAddon = ({ align, className, ...props }: InputAddonProps) => {
  return <View className={cn(inputAddonVariants({ align }), className)} {...props} />;
};

export const InputAddonIcon = ({
  children,
  ...props
}: InputAddonIconProps): React.ReactElement | null => {
  const child = Children.only(children);

  if (!child) {
    if (__DEV__) {
      throw new Error('InputAddonIcon expects a single React element as children');
    }
    return null;
  }

  return (
    <>
      {cloneElement(child as React.ReactElement<InputAddonIconProps>, {
        ...props,
        className: cn('size-6 text-muted-foreground', props.className),
      })}
    </>
  );
};

export const InputAddonButton = ({
  className,
  variant = 'ghost',
  size = 'sm',
  disabled,
  busy,
  ...props
}: InputAddonButtonProps) => {
  const ctx = useMemo(() => ({ size, variant }), [size, variant]);
  return (
    <InputAddonButtonContext.Provider value={ctx}>
      <Button
        {...props}
        busy={busy}
        className={cn(inputAddonButtonVariants({ size }), className)}
        disabled={disabled}
        size={size}
        variant={variant}
      />
    </InputAddonButtonContext.Provider>
  );
};

export const InputAddonButtonIcon = (
  props: React.ComponentProps<typeof ButtonIcon>
) => {
  const ctx = useInputAddonButtonContext();

  return (
    <ButtonIcon
      {...props}
      className={cn(inputAddonButtonIconVariants(ctx), props.className)}
    />
  );
};
