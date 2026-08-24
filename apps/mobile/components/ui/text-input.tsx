import { forwardRef } from 'react';
import { View, type TextInput as RNTextInput } from 'react-native';
import { INPUT_SHELL_CLASS } from '@/constants/catalogToolbar';
import { cn, mergeRefs } from '@/lib/utils';
import { Input } from './input';
import type { InputAddonChildren, InputProps } from './input.types';
import { useInputAddons, useInputFocusState } from './input.hooks';

export type TextInputProps = InputProps & {
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  children?: InputAddonChildren;
};

/** Not wrapped in InputPressable — parent Pressable steals responder and jumps the caret. */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  ({ onFocus, onBlur, disabled, invalid, children, className, ...props }, ref) => {
    const { isFocused, internalRef, handleFocus, handleBlur } = useInputFocusState({
      onFocus,
      onBlur,
    });
    const mergedRef = mergeRefs(internalRef, ref);

    const { startAddons, endAddons, pressableClassName } = useInputAddons(children);

    return (
      <View
        className={cn(
          pressableClassName,
          INPUT_SHELL_CLASS,
          'flex-row items-center gap-2 border',
          !invalid && !isFocused && 'border-border',
          !invalid && isFocused && 'border-ring/50',
          invalid && 'border-destructive',
          disabled && 'opacity-50',
          className
        )}
      >
        {startAddons}

        <Input
          {...props}
          className="min-w-0 flex-1 shrink"
          disabled={disabled}
          onBlur={handleBlur}
          onFocus={handleFocus}
          ref={mergedRef}
        />

        {endAddons}
      </View>
    );
  }
);

TextInput.displayName = 'TextInput';
