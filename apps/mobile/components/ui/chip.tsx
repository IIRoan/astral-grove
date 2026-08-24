import { type VariantProps } from 'class-variance-authority';
import { Children, cloneElement, createContext, useContext, useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import {
  chipIconVariants,
  chipTextVariants,
  chipVariants,
} from '@/components/ui/chip.variants';
import type { ChipProps } from '@/components/ui/chip.types';
import { textFontStyleForClassName } from '@/lib/fonts';
import { cn } from '@/lib/utils';

type InternalChipContextType = VariantProps<typeof chipVariants> & {
  disabled?: boolean;
};

type ChipChildProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.ComponentProps<typeof Text>['style'];
};

const ChipContext = createContext<InternalChipContextType | null>(null);

const useChipContext = () => {
  const context = useContext(ChipContext);
  if (!context) {
    throw new Error('useChipContext must be used within a Chip component');
  }
  return context;
};

export const Chip = ({
  accessibilityRole = 'button',
  children,
  className,
  disabled,
  variant,
  ...props
}: ChipProps) => {
  const ctx = useMemo(() => {
    return {
      disabled: disabled ?? undefined,
      variant,
    };
  }, [disabled, variant]);

  return (
    <ChipContext.Provider value={ctx}>
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled: Boolean(disabled) }}
        className={cn(chipVariants({ variant, className }))}
        {...props}
      >
        {Children.map(children, (child) => {
          if (typeof child === 'string') {
            return <ChipText>{child}</ChipText>;
          }

          return child;
        })}
      </Pressable>
    </ChipContext.Provider>
  );
};

export const ChipText = (props: ChipChildProps) => {
  const ctx = useChipContext();
  const merged = cn(chipTextVariants(ctx), props.className);

  return (
    <Text
      {...props}
      className={merged}
      style={[textFontStyleForClassName(merged), props.style]}
    />
  );
};

export const ChipIcon = ({ children, ...props }: ChipChildProps) => {
  const ctx = useChipContext();

  const child = Children.only(children);

  if (!child) {
    if (__DEV__) {
      throw new Error('ChipIcon expects a single React element as children');
    }
    return null;
  }

  return (
    <>
      {cloneElement(child as React.ReactElement<ChipChildProps>, {
        ...props,
        className: cn(chipIconVariants(ctx), props.className),
      })}
    </>
  );
};
