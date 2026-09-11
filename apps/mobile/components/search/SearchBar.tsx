import { memo, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  View,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputKeyPressEventData,
  type TextInputProps,
  type TextInputSubmitEditingEventData,
} from 'react-native';
import {
  InputAddon,
  InputAddonButton,
  InputAddonButtonIcon,
} from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { XIcon } from '@/components/icons';
import { useHoldResultsSearchInput } from '@/hooks/useHoldResultsSearchInput';
import { useLatestRef } from '@/hooks/useLatestRef';
import { useWebSlashFocus } from '@/hooks/useWebSlashFocus';
import { cn } from '@/lib/utils';
import { isSlashShortcutTextChange } from '@/utils/webSlashFocus';

interface SearchBarProps extends Pick<TextInputProps, 'onSubmitEditing' | 'autoFocus'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  isLoading?: boolean;
  placeholder?: string;
  /** Web: show `/` hint and bind slash-to-focus / slash-to-clear. Defaults to true. */
  enableSlashFocus?: boolean;
  /** Draft when typing, else committed — drives catalog search while the field is focused. */
  onActiveQueryChange?: (query: string) => void;
}

/** Focus/`/` clears draft without committing; X commits empty and resets results. */
export const SearchBar = memo(function SearchBar({
  value,
  onChangeText,
  onClear,
  isLoading = false,
  placeholder = 'Search cards…',
  onSubmitEditing,
  autoFocus,
  enableSlashFocus = true,
  onActiveQueryChange,
}: SearchBarProps) {
  const inputRef = useRef<TextInput>(null);
  const searchFocusedRef = useRef(false);
  const {
    draft,
    onFocus: holdOnFocus,
    onBlur: holdOnBlur,
    onChangeText: onDraftChange,
    onClear: clearDraftAndCommit,
    onHoldClear,
    flush,
  } = useHoldResultsSearchInput(value, onChangeText, onActiveQueryChange);

  const draftRef = useLatestRef(draft);

  const clearSearch = useCallback(() => {
    clearDraftAndCommit();
    onClear();
  }, [clearDraftAndCommit, onClear]);

  const onFocus = useCallback(() => {
    searchFocusedRef.current = true;
    holdOnFocus();
  }, [holdOnFocus]);

  const onBlur = useCallback(() => {
    searchFocusedRef.current = false;
    holdOnBlur();
  }, [holdOnBlur]);

  /** Clear draft via `/` without resetting committed search results. */
  const clearDraftKeepResults = useCallback(() => {
    if (draftRef.current.length === 0) return;
    onHoldClear();
  }, [draftRef, onHoldClear]);

  useWebSlashFocus(inputRef, {
    enabled: enableSlashFocus,
    searchFocusedRef,
    onClearWhileFocused: clearDraftKeepResults,
  });

  /** Reliable path: RN-web often commits `ahri/` before window preventDefault. */
  const handleChangeText = useCallback(
    (text: string) => {
      if (
        enableSlashFocus &&
        Platform.OS === 'web' &&
        isSlashShortcutTextChange(text)
      ) {
        // "ahri" + "/" → empty draft, keep prior committed results.
        onHoldClear();
        return;
      }
      onDraftChange(text);
    },
    [enableSlashFocus, onDraftChange, onHoldClear]
  );

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (!enableSlashFocus || Platform.OS !== 'web') return;
      if (event.nativeEvent.key !== '/') return;
      (event as unknown as { preventDefault?: () => void }).preventDefault?.();
      clearDraftKeepResults();
    },
    [clearDraftKeepResults, enableSlashFocus]
  );

  const handleSubmitEditing = useCallback(
    (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      flush();
      onSubmitEditing?.(event);
    },
    [flush, onSubmitEditing]
  );

  // Keep end-addon slots mounted — toggling Pressable children remounts the field on web.
  const showClear = draft.length > 0 || value.length > 0;

  return (
    <View className="relative w-full">
      <SearchInput
        ref={inputRef}
        value={draft}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={handleSubmitEditing}
        autoFocus={autoFocus}
        shortcutHint={enableSlashFocus ? '/' : undefined}
      >
        <InputAddon
          align="inline-end"
          className={cn(!showClear && 'w-0 min-w-0 overflow-hidden opacity-0')}
        >
          <InputAddonButton
            accessibilityElementsHidden={!showClear}
            accessibilityLabel="Clear search"
            importantForAccessibility={showClear ? 'yes' : 'no-hide-descendants'}
            onPress={clearSearch}
            size="sm"
            tabIndex={showClear ? 0 : -1}
            variant="ghost"
          >
            <InputAddonButtonIcon>
              <XIcon />
            </InputAddonButtonIcon>
          </InputAddonButton>
        </InputAddon>
      </SearchInput>
      {isLoading ? (
        <View
          accessibilityElementsHidden
          className={cn(
            'absolute bottom-0 top-0 justify-center',
            showClear ? 'right-11' : 'right-3'
          )}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          <ActivityIndicator size="small" className="accent-primary" />
        </View>
      ) : null}
    </View>
  );
});
