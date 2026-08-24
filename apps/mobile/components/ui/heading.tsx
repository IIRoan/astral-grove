import { cva, type VariantProps } from 'class-variance-authority';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type HeadingProps = React.ComponentProps<typeof Text> &
  VariantProps<typeof headingVariants>;

export const Heading = ({ children, className, level, ...props }: HeadingProps) => {
  return (
    <Text className={cn(headingVariants({ className, level }))} {...props}>
      {children}
    </Text>
  );
};

const headingVariants = cva('font-sans font-bold text-foreground tracking-tight', {
  variants: {
    level: {
      '1': 'text-4xl',
      '2': 'text-3xl',
      '3': 'text-2xl',
      '4': 'text-xl',
      '5': 'text-lg',
      '6': 'text-base',
    },
  },
  defaultVariants: {
    level: '1',
  },
});
