import type { VariantProps } from 'class-variance-authority';
import type { Pressable, TextInput as RNTextInput, View } from 'react-native';
import type { inputAddonVariants } from '@/components/ui/input.variants';

export type InputProps = Omit<
  React.ComponentPropsWithRef<typeof RNTextInput>,
  'editable'
> & {
  disabled?: boolean;
};

export type InputPressableProps = React.ComponentProps<typeof Pressable> & {
  disabled?: boolean;
  invalid?: boolean;
  focused?: boolean;
  bordered?: boolean;
};

export type InputAddonProps = React.ComponentProps<typeof View> &
  VariantProps<typeof inputAddonVariants> & {
    children: React.ReactNode;
  };

export type InputAddonChild = React.ReactElement<InputAddonProps> | null | false;

export type InputAddonChildren = InputAddonChild | InputAddonChild[];
