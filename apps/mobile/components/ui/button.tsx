import { type VariantProps } from 'class-variance-authority';
import {
  Children,
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ButtonProps } from '@/components/ui/button.types';
import {
  buttonIconVariants,
  buttonSpinnerVariants,
  buttonTextVariants,
  buttonVariants,
} from '@/components/ui/button.variants';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MOTION, PRESS } from '@/lib/motion';
import { textFontStyleForClassName } from '@/lib/fonts';
import { cn } from '@/lib/utils';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type InternalButtonContextType = VariantProps<typeof buttonVariants> & {
  busy?: boolean;
  disabled?: boolean;
};

type ButtonChildProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.ComponentProps<typeof Text>['style'];
};

const ButtonContext = createContext<InternalButtonContextType | null>(null);

const useButtonContext = () => {
  const context = useContext(ButtonContext);
  if (!context) {
    throw new Error('useButtonContext must be used within a Button component');
  }
  return context;
};

export const Button = ({
  className,
  variant,
  size,
  busy,
  disabled,
  children,
  accessibilityRole = 'button',
  onPressIn,
  onPressOut,
  style,
  ...props
}: ButtonProps) => {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const ctx = useMemo(() => {
    return {
      variant,
      size,
      busy,
      disabled,
    };
  }, [variant, size, busy, disabled]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!(disabled || busy)) {
        if (reduceMotion) {
          opacity.value = withTiming(0.75, { duration: PRESS.inMs });
        } else {
          scale.value = withTiming(PRESS.depth, { duration: PRESS.inMs });
        }
      }
      onPressIn?.(event);
    },
    [busy, disabled, onPressIn, opacity, reduceMotion, scale]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (reduceMotion) {
        opacity.value = withTiming(1, { duration: 140 });
      } else {
        scale.value = withSpring(1, MOTION.bouncy);
      }
      onPressOut?.(event);
    },
    [onPressOut, opacity, reduceMotion, scale]
  );

  return (
    <ButtonContext.Provider value={ctx}>
      <AnimatedPressable
        accessibilityRole={accessibilityRole}
        accessibilityState={{ busy, disabled }}
        className={cn(
          buttonVariants({ variant, size }),
          className,
          disabled && 'opacity-50'
        )}
        disabled={disabled || busy}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[pressStyle, style]}
        {...props}
      >
        {Children.map(children, (child) => {
          if (typeof child === 'string') {
            if (size === 'icon') {
              return null;
            }
            return <ButtonText>{child}</ButtonText>;
          }

          return child;
        })}
        {busy ? <ButtonSpinner /> : null}
      </AnimatedPressable>
    </ButtonContext.Provider>
  );
};

export const ButtonText = (props: ButtonChildProps) => {
  const ctx = useButtonContext();
  const merged = cn(buttonTextVariants(ctx), ctx.busy && 'opacity-0', props.className);

  return (
    <Text
      {...props}
      className={merged}
      style={[textFontStyleForClassName(merged), props.style]}
    />
  );
};

export const ButtonIcon = ({ children, ...props }: ButtonChildProps) => {
  const ctx = useButtonContext();

  const child = Children.only(children);

  if (!child) {
    if (__DEV__) {
      throw new Error('ButtonIcon expects a single React element as children');
    }
    return null;
  }

  return (
    <>
      {cloneElement(child as React.ReactElement<ButtonChildProps>, {
        ...props,
        className: cn(
          buttonIconVariants(ctx),
          ctx.busy && 'opacity-0',
          props.className
        ),
      })}
    </>
  );
};

const ButtonSpinner = () => {
  const ctx = useButtonContext();

  return (
    <ActivityIndicator
      className="absolute"
      colorClassName={buttonSpinnerVariants(ctx)}
    />
  );
};
