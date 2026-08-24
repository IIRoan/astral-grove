import { cva } from 'class-variance-authority';

export const chipVariants = cva(
  'flex w-fit shrink-0 flex-row items-center justify-center gap-1 self-start overflow-hidden whitespace-nowrap rounded-[3px] px-2.5 py-1.5 font-semibold text-xs',
  {
    variants: {
      variant: {
        default: 'border border-border bg-card-panel active:opacity-80',
        secondary: 'bg-card-panel active:opacity-80',
        destructive: 'bg-destructive active:bg-destructive/80 dark:bg-destructive/60',
        outline: 'border border-border bg-transparent active:bg-card-panel',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export const chipTextVariants = cva(
  'whitespace-nowrap font-semibold text-sm leading-tight',
  {
    variants: {
      variant: {
        default: 'text-foreground',
        secondary: 'text-foreground',
        destructive: 'text-white',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export const chipIconVariants = cva('size-4', {
  variants: {
    variant: {
      default: 'text-foreground',
      secondary: 'text-foreground',
      destructive: 'text-white',
      outline: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
