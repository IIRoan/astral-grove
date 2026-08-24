import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  CatalogSegmentedControl,
  type CatalogSegmentOption,
} from '@/components/catalog/CatalogSegmentedControl';
import { EyeIcon, PencilIcon, ThemedIcon } from '@/components/icons';
import { SecureMarkdown } from '@/components/ui/markdown';
import { Text } from '@/components/ui/text';
import { TextareaInput } from '@/components/ui/textarea-input';
import { useFocusedTextDraft } from '@/hooks/useFocusedTextDraft';
import { clampMarkdownSource } from '@/lib/markdown-safe';
import { cn } from '@/lib/utils';

type EditorMode = 'write' | 'preview';

const MODE_OPTIONS: readonly CatalogSegmentOption<EditorMode>[] = [
  { id: 'write', label: 'Write', icon: PencilIcon },
  { id: 'preview', label: 'Preview', icon: EyeIcon },
];

interface DeckDescriptionViewProps {
  description: string;
  className?: string;
  hideWhenEmpty?: boolean;
}

interface DeckDescriptionEditorProps {
  value: string;
  onChange: (description: string) => void;
  className?: string;
  fill?: boolean;
}

export function DeckDescriptionView({
  description,
  className,
  hideWhenEmpty = true,
}: DeckDescriptionViewProps) {
  const trimmed = description.trim();
  if (hideWhenEmpty && !trimmed) return null;

  return (
    <View
      className={cn(
        'gap-1.5 rounded-[3px] border border-border bg-card-panel px-2.5 py-2',
        className
      )}
    >
      <Text className="text-[11px] font-normal text-muted-foreground">Description</Text>
      <SecureMarkdown>{trimmed}</SecureMarkdown>
    </View>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) {
  return (
    <CatalogSegmentedControl value={mode} onChange={onChange} options={MODE_OPTIONS} />
  );
}

function DeckDescriptionEditor({
  value,
  onChange,
  className,
  fill = false,
}: DeckDescriptionEditorProps) {
  const [mode, setMode] = useState<EditorMode>('write');
  // Local draft + debounced commit — cache refresh must not rewrite mid-keystroke (caret jump).
  const descriptionDraft = useFocusedTextDraft(value, onChange, {
    transform: clampMarkdownSource,
  });

  const trimmed = descriptionDraft.value.trim();

  const body =
    mode === 'write' ? (
      <>
        <TextareaInput
          value={descriptionDraft.value}
          onChangeText={descriptionDraft.onChangeText}
          onFocus={descriptionDraft.onFocus}
          onBlur={descriptionDraft.onBlur}
          placeholder={
            '# Matchup guide\n\n**Game plan**\n- Keep pressure early\n- [Guide](https://…)'
          }
          className={cn(fill ? 'min-h-0 flex-1' : 'min-h-32')}
        />
        <Text className="text-[11px] leading-4 text-muted-foreground">
          Markdown supported. Links must be http(s) or mailto — HTML and images are
          ignored.
        </Text>
      </>
    ) : trimmed ? (
      <ScrollView
        className={cn(
          'rounded-[3px] border border-border bg-card-panel',
          fill ? 'min-h-0 flex-1' : undefined
        )}
        contentContainerClassName="px-5 py-5"
        contentContainerStyle={fill ? { flexGrow: 1 } : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-auto w-full max-w-2xl gap-1">
          <Text className="mb-3 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
            Rendered preview
          </Text>
          <SecureMarkdown variant="prose">{trimmed}</SecureMarkdown>
        </View>
      </ScrollView>
    ) : (
      <View
        className={cn(
          'items-center justify-center gap-2 rounded-[3px] border border-dashed border-border bg-card-panel/60 px-6 py-8',
          fill ? 'min-h-0 flex-1' : 'min-h-32'
        )}
      >
        <View className="size-10 items-center justify-center rounded-[3px] bg-muted">
          <ThemedIcon icon={EyeIcon} size={18} color="muted-foreground" />
        </View>
        <Text className="text-[14px] font-normal text-foreground">
          Nothing to preview
        </Text>
        <Text className="max-w-xs text-center text-[12px] leading-5 text-muted-foreground">
          Switch to Write and add markdown — headings, lists, and bold will show up
          here.
        </Text>
      </View>
    );

  return (
    <View className={cn('gap-3', fill && 'min-h-0 flex-1', className)}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-[15px] font-normal text-foreground">Description</Text>
          <Text className="text-[12px] text-muted-foreground">
            {mode === 'write'
              ? 'Edit markdown source'
              : 'How your description will look'}
          </Text>
        </View>
        <ModeToggle mode={mode} onChange={setMode} />
      </View>
      {body}
    </View>
  );
}

interface DeckDescriptionPanelProps {
  value: string;
  onChange: (description: string) => void;
  paddingBottom?: number;
  className?: string;
}

export function DeckDescriptionPanel({
  value,
  onChange,
  paddingBottom = 0,
  className,
}: DeckDescriptionPanelProps) {
  return (
    <View
      className={cn(
        'min-h-0 flex-1 overflow-hidden rounded-[10px] border border-border bg-card px-5 py-5',
        className
      )}
      style={{ paddingBottom: Math.max(paddingBottom, 16) }}
    >
      <DeckDescriptionEditor value={value} onChange={onChange} fill />
    </View>
  );
}
