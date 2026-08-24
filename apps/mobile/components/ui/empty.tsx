import { type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';
import { emptyMediaVariants } from '@/components/ui/empty.variants';
import { cn } from '@/lib/utils';
import { Text } from './text';

type EmptyMediaProps = React.ComponentProps<typeof View> &
  VariantProps<typeof emptyMediaVariants>;

export const Empty = ({ className, ...props }: React.ComponentProps<typeof View>) => {
  return (
    <View
      className={cn(
        'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance rounded-[10px] border-dashed p-6 text-center',
        className
      )}
      data-slot="empty"
      {...props}
    />
  );
};

export const EmptyHeader = ({
  className,
  ...props
}: React.ComponentProps<typeof View>) => {
  return (
    <View
      className={cn('flex max-w-sm flex-col items-center gap-0.5', className)}
      data-slot="empty-header"
      {...props}
    />
  );
};

export const EmptyMedia = ({
  className,
  variant = 'default',
  ...props
}: EmptyMediaProps) => {
  return (
    <View
      className={cn(emptyMediaVariants({ variant, className }))}
      data-slot="empty-icon"
      data-variant={variant}
      {...props}
    />
  );
};

export const EmptyTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof Text>) => {
  return (
    <Text
      className={cn('font-medium text-base tracking-tight', className)}
      data-slot="empty-title"
      {...props}
    />
  );
};

export const EmptyDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof Text>) => {
  return (
    <Text
      className={cn(
        'text-center text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
        className
      )}
      data-slot="empty-description"
      {...props}
    />
  );
};
