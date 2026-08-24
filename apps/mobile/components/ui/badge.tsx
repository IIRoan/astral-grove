import { type VariantProps } from 'class-variance-authority';
import { Children, cloneElement, createContext, useContext, useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  badgeIconVariants,
  badgeTextVariants,
  badgeVariants,
} from '@/components/ui/badge.variants';
import type { BadgeProps } from '@/components/ui/badge.types';
import { cn } from '@/lib/utils';

type InternalBadgeContextType = VariantProps<typeof badgeVariants>;

type BadgeChildProps = {
  children: React.ReactNode;
  className?: string;
};

const BadgeContext = createContext<InternalBadgeContextType | null>(null);

const useBadgeContext = () => {
  const context = useContext(BadgeContext);
  if (!context) {
    throw new Error('useBadgeContext must be used within a Badge component');
  }
  return context;
};

export const Badge = ({ children, className, variant, ...props }: BadgeProps) => {
  const ctx = useMemo(() => {
    return {
      variant,
    };
  }, [variant]);

  return (
    <BadgeContext.Provider value={ctx}>
      <View className={cn(badgeVariants({ variant, className }))} {...props}>
        {Children.map(children, (child) => {
          if (typeof child === 'string') {
            return <BadgeText>{child}</BadgeText>;
          }

          return child;
        })}
      </View>
    </BadgeContext.Provider>
  );
};

export const BadgeText = (props: BadgeChildProps) => {
  const ctx = useBadgeContext();

  return <Text {...props} className={cn(badgeTextVariants(ctx), props.className)} />;
};

export const BadgeIcon = ({ children, ...props }: BadgeChildProps) => {
  const ctx = useBadgeContext();

  const child = Children.only(children);

  if (!child) {
    if (__DEV__) {
      throw new Error('BadgeIcon expects a single React element as children');
    }
    return null;
  }

  return (
    <>
      {cloneElement(child as React.ReactElement<BadgeChildProps>, {
        ...props,
        className: cn(badgeIconVariants(ctx), props.className),
      })}
    </>
  );
};
