import type { VariantProps } from 'class-variance-authority';
import type { Pressable, View } from 'react-native';
import type { Text } from '@/components/ui/text';
import type { inlineListItemAddonVariants } from '@/components/ui/inline-list.variants';

export type InlineListProps = React.ComponentProps<typeof View> & {
  title?: string;
  children: React.ReactNode;
};

type InlineListItemVariant = 'default' | 'destructive';

export type InlineListItemProps = React.ComponentProps<typeof Pressable> & {
  children: React.ReactNode;
  showSeparator?: boolean;
  variant?: InlineListItemVariant;
};

export type InlineListItemTitleProps = React.ComponentProps<typeof Text>;
export type InlineListItemDescriptionProps = React.ComponentProps<typeof Text>;

export type InlineListItemAddonProps = React.ComponentProps<typeof View> &
  VariantProps<typeof inlineListItemAddonVariants> & {
    children: React.ReactNode;
  };

export type InlineListItemAddonChild =
  React.ReactElement<InlineListItemAddonProps> | null | false;

export type InlineListItemAddonChildren =
  InlineListItemAddonChild | InlineListItemAddonChild[];

export type InlineListItemAddonAlign = NonNullable<
  VariantProps<typeof inlineListItemAddonVariants>['align']
>;
