import {
  CloudUploadIcon,
  DownloadIcon,
  TrashIcon,
  type LucideIcon,
} from '@/components/icons';
import { ActivityIndicator, Pressable, View, type DimensionValue } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { HoverTooltip, ToolbarIconSlot } from '@/components/ui/hover-tooltip';
import {
  toolbarButtonSize,
  toolbarIconSize,
} from '@/components/ui/hover-tooltip.constants';
import { Text } from '@/components/ui/text';
import { useCollectionImportExport } from '@/hooks/useCollectionImportExport';
import { cn } from '@/lib/utils';

const isDevCollectionToolsEnabled =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function useImportExportUi(disabled: boolean) {
  const { importCsv, exportCsv, clearCollection, importProgress } =
    useCollectionImportExport();

  const busy = importCsv.isPending || exportCsv.isPending || clearCollection.isPending;
  const importResult = importCsv.data;
  const importError =
    importCsv.error instanceof Error
      ? importCsv.error.message
      : exportCsv.error instanceof Error
        ? exportCsv.error.message
        : clearCollection.error instanceof Error
          ? clearCollection.error.message
          : null;

  const progressPercent =
    importProgress && importProgress.total > 0
      ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))
      : 0;

  const hasStatus = Boolean(importProgress || importResult || importError);
  const controlsDisabled = disabled || busy;

  return {
    importCsv,
    exportCsv,
    clearCollection,
    importProgress,
    busy,
    importResult,
    importError,
    progressPercent,
    hasStatus,
    controlsDisabled,
  };
}

function ToolbarIconButton({
  icon,
  label,
  disabled,
  busy,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
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
          'items-center justify-center rounded-[3px] active:bg-background/70',
          (disabled || busy) && 'opacity-45'
        )}
        style={{ width: toolbarButtonSize, height: toolbarButtonSize }}
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
  const { importCsv, exportCsv, clearCollection, controlsDisabled } =
    useImportExportUi(disabled);

  return (
    <View className="shrink-0 flex-row items-center rounded-[3px] bg-card-panel p-0.5">
      <ToolbarIconButton
        icon={CloudUploadIcon}
        label="Import CSV"
        disabled={controlsDisabled}
        busy={importCsv.isPending}
        onPress={() => {
          void importCsv.mutateAsync().catch(() => undefined);
        }}
      />
      <ToolbarIconButton
        icon={DownloadIcon}
        label="Export CSV"
        disabled={controlsDisabled}
        busy={exportCsv.isPending}
        onPress={() => {
          void exportCsv.mutateAsync().catch(() => undefined);
        }}
      />
      {isDevCollectionToolsEnabled ? (
        <ToolbarIconButton
          icon={TrashIcon}
          label="Clear collection"
          disabled={controlsDisabled}
          busy={clearCollection.isPending}
          onPress={() => {
            void clearCollection.mutateAsync().catch(() => undefined);
          }}
        />
      ) : null}
    </View>
  );
}

export function CollectionImportExportStatus({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { importProgress, importResult, importError, progressPercent, hasStatus } =
    useImportExportUi(disabled);

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
