import { useCallback, useState } from 'react';
import { View, type BlurEvent, type FocusEvent } from 'react-native';
import { INPUT_TEXTAREA_SHELL_CLASS } from '@/constants/catalogToolbar';
import { cn } from '@/lib/utils';
import { Input } from './input';
import type { InputProps } from './input.types';

export type TextareaInputProps = InputProps & {
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: BlurEvent) => void;
  disabled?: boolean;
  invalid?: boolean;
};

/** Not wrapped in InputPressable — parent Pressable steals responder and jumps the caret. */
export const TextareaInput = ({
  onFocus,
  onBlur,
  disabled,
  invalid,
  className,
  ...props
}: TextareaInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(
    (e: FocusEvent) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (e: BlurEvent) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  return (
    <View
      className={cn(
        INPUT_TEXTAREA_SHELL_CLASS,
        'border',
        !invalid && !isFocused && 'border-border',
        !invalid && isFocused && 'border-ring/50',
        invalid && 'border-destructive',
        disabled && 'opacity-50',
        className
      )}
    >
      <Input
        {...props}
        className="min-h-24 w-full flex-1"
        disabled={disabled}
        multiline
        onBlur={handleBlur}
        onFocus={handleFocus}
        scrollEnabled
        textAlignVertical="top"
      />
    </View>
  );
};
