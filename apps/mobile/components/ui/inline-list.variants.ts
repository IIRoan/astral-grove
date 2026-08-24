import { cva } from 'class-variance-authority';

export const inlineListItemVariants = cva(
  'min-h-12 w-full flex-row items-center gap-3 px-4 py-2 disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'active:bg-accent/90 dark:active:bg-accent/50',
        destructive: 'active:bg-destructive/5 dark:active:bg-destructive/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export const inlineListItemAddonVariants = cva('shrink-0 items-center justify-center', {
  variants: {
    align: {
      'inline-start': '',
      'inline-end': '',
    },
  },
  defaultVariants: {
    align: 'inline-start',
  },
});
