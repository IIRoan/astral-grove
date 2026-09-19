import {
  CameraIcon,
  CloudUploadIcon,
  DownloadIcon,
  HashIcon,
  type LucideIcon,
} from '@/components/icons';
import { CollectionTtsImportSheet } from '@/components/collection/CollectionTtsImportSheet';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
  type DimensionValue,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import { HoverTooltip, ToolbarIconSlot } from '@/components/ui/hover-tooltip';
import { toolbarIconSize } from '@/components/ui/hover-tooltip.constants';
import { Text } from '@/components/ui/text';
import {
  catalogToolbarGroupClass,
  catalogToolbarSegmentClasses,
} from '@/constants/catalogToolbar';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useCollectionImportExport } from '@/hooks/useCollectionImportExport';
import { cn } from '@/lib/utils';

function ToolbarIconButton({
  icon,
  label,
  disabled,
  busy,
  onPress,
  mobile,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
  mobile: boolean;
}) {
  const iconColor = useCSSVariable('--color-muted-foreground') as string;
  const Icon = icon;

  return (
    <HoverTooltip label={label}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled }}
        disabled={disabled || busy}
        hitSlop={2}
        onPress={onPress}
        className={cn(
          mobile
            ? catalogToolbarSegmentClasses(false, true)
            : 'size-8 items-center justify-center rounded-[3px] active:bg-background/70',
          (disabled || busy) && 'opacity-45'
        )}
      >
        <ToolbarIconSlot>
          {busy ? (
            <ActivityIndicator
              size="small"
              color={iconColor}
              style={{ transform: [{ scale: 0.85 }] }}
            />
          ) : (
            <Icon size={toolbarIconSize} color={iconColor} />
          )}
        </ToolbarIconSlot>
      </Pressable>
    </HoverTooltip>
  );
}

export function CollectionImportExportToolbar({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { importCsv, exportCsv, ttsSheetOpen, setTtsSheetOpen, previewTts, acceptTts } =
    useCollectionImportExport();
  const mobile = useMobileLayout();

  const busy =
    importCsv.isPending ||
    exportCsv.isPending ||
    previewTts.isPending ||
    acceptTts.isPending;
  const controlsDisabled = disabled || busy;

  return (
    <>
      <View
        className={
          mobile
            ? cn(catalogToolbarGroupClass(true), 'self-start')
            : 'shrink-0 flex-row items-center rounded-[3px] bg-card-panel p-0.5'
        }
      >
        {Platform.OS === 'ios' ? (
          <ToolbarIconButton
            icon={CameraIcon}
            label="Scan cards"
            disabled={controlsDisabled}
            onPress={() => router.push('/collection/scan')}
            mobile={mobile}
          />
        ) : null}
        <ToolbarIconButton
          icon={HashIcon}
          label="Import TTS list"
          disabled={controlsDisabled}
          onPress={() => setTtsSheetOpen(true)}
          mobile={mobile}
        />
        <ToolbarIconButton
          icon={CloudUploadIcon}
          label="Import CSV"
          disabled={controlsDisabled}
          busy={importCsv.isPending}
          onPress={() => {
            void importCsv.mutateAsync().catch(() => undefined);
          }}
          mobile={mobile}
        />
        <ToolbarIconButton
          icon={DownloadIcon}
          label="Export CSV"
          disabled={controlsDisabled}
          busy={exportCsv.isPending}
          onPress={() => {
            void exportCsv.mutateAsync().catch(() => undefined);
          }}
          mobile={mobile}
        />
      </View>

      <CollectionTtsImportSheet
        open={ttsSheetOpen}
        onClose={() => setTtsSheetOpen(false)}
        previewPending={previewTts.isPending}
        acceptPending={acceptTts.isPending}
        onPreview={(tts) => previewTts.mutateAsync(tts)}
        onAccept={async (items) => {
          await acceptTts.mutateAsync(items);
        }}
      />
    </>
  );
}

export function CollectionImportExportStatus({
  disabled: _disabled = false,
}: {
  disabled?: boolean;
}) {
  const { importCsv, exportCsv, importProgress } = useCollectionImportExport();

  const importResult = importCsv.data;
  const importError =
    importCsv.error instanceof Error
      ? importCsv.error.message
      : exportCsv.error instanceof Error
        ? exportCsv.error.message
        : null;

  const progressPercent =
    importProgress && importProgress.total > 0
      ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))
      : 0;

  const hasStatus = Boolean(importProgress || importResult || importError);
  if (!hasStatus) return null;

  return (
    <View className="gap-1.5">
      {importProgress ? (
        <View className="gap-1.5">
          <Text className="font-mono text-[11px] text-archive-subtle">
            {importProgress.message}
          </Text>
          {importProgress.phase === 'importing' && importProgress.total > 1 ? (
            <View className="h-1 overflow-hidden rounded-[3px] bg-card-panel">
              <View
                className="h-full rounded-[3px] bg-foreground"
                style={{ width: `${progressPercent}%` as DimensionValue }}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {importResult ? (
        <Text className="font-mono text-[11px] leading-relaxed text-archive-subtle">
          Imported {importResult.totalCopies.toLocaleString()} copies across{' '}
          {importResult.imported.toLocaleString()} printings
          {importResult.rowsProcessed > 0
            ? ` from ${importResult.rowsProcessed.toLocaleString()} CSV rows`
            : ''}
          {importResult.failedRows > 0
            ? ` · ${importResult.failedRows.toLocaleString()} rows could not be imported`
            : ''}
        </Text>
      ) : null}

      {importError && importError !== 'Import cancelled' ? (
        <Text className="text-[11px] text-destructive">{importError}</Text>
      ) : null}
    </View>
  );
}
