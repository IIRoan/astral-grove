import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'flex w-full shrink-0 flex-row items-center justify-center gap-2 whitespace-nowrap rounded-[3px] font-bold text-sm',
  {
    variants: {
      size: {
        default: 'min-h-12 px-4',
        sm: 'min-h-8 gap-1 px-3',
        lg: 'min-h-14 px-6',
        'icon-sm': 'size-8',
        icon: 'size-12',
        'icon-lg': 'size-14',
      },
      variant: {
        default: 'bg-cta active:opacity-80',
        destructive: 'bg-destructive active:bg-destructive/80 dark:bg-destructive/60',
        outline:
          'border border-border bg-transparent active:bg-card-panel dark:border-border',
        secondary: 'bg-card-panel active:opacity-80',
        ghost: 'bg-transparent active:bg-card-panel',
        link: 'h-auto min-h-0 w-auto p-0 active:opacity-50',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export const buttonTextVariants = cva('whitespace-nowrap font-bold text-sm', {
  variants: {
    variant: {
      default: 'text-cta-foreground',
      destructive: 'text-white',
      outline: 'text-foreground',
      secondary: 'text-foreground',
      ghost: 'text-foreground',
      link: 'text-foreground',
    },
    size: {
      default: 'text-lg',
      sm: 'text-sm',
      lg: 'text-xl',
      'icon-sm': '',
      icon: '',
      'icon-lg': '',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export const buttonIconVariants = cva('', {
  variants: {
    variant: {
      default: 'text-cta-foreground',
      destructive: 'text-white',
      outline: 'text-foreground',
      secondary: 'text-foreground',
      ghost: 'text-foreground',
      link: 'text-foreground',
    },
    size: {
      default: 'size-6',
      lg: 'size-7',
      sm: 'size-5',
      'icon-sm': 'size-6',
      icon: 'size-7',
      'icon-lg': 'size-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export const buttonSpinnerVariants = cva('', {
  variants: {
    variant: {
      default: 'accent-cta-foreground',
      destructive: 'accent-white',
      outline: 'accent-foreground',
      secondary: 'accent-foreground',
      ghost: 'accent-foreground',
      link: 'accent-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
