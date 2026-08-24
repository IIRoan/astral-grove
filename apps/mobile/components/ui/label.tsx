import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type LabelProps = React.ComponentProps<typeof Text>;

export const Label = ({ children, className, ...props }: LabelProps) => {
  return (
    <Text
      className={cn('font-sans text-sm font-semibold text-foreground', className)}
      {...props}
    >
      {children}
    </Text>
  );
};
