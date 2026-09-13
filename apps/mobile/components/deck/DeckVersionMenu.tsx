import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ThemedIcon,
  CheckIcon,
  ChevronDownIcon,
  CloudOffIcon,
  CloudUploadIcon,
  PencilIcon,
  TrashIcon,
} from '@/components/icons';
import { DeckVersionNameSheet } from '@/components/deck/DeckVersionNameSheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  AppSheet,
  AppSheetContent,
  AppSheetFooter,
  AppSheetHeader,
  AppSheetOverlay,
  AppSheetPortal,
  AppSheetScrollView,
  AppSheetTitle,
} from '@/components/ui/app-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useDeckSaveStatus } from '@/hooks/useDeckSaveStatus';
import { useDeckVersions } from '@/hooks/useDeckVersions';
import { formatVersionUpdatedAt } from '@/lib/deck-version';
import type { DeckState } from '@/lib/deck-types';
import { cn } from '@/lib/utils';
import { flushEditorDeckSave, type DeckSaveStatus } from '@/services/deckService';
import type { DeckVersionSummary } from '@riftbound/contracts';
import { hapticPress } from '@/utils/haptics';

const TOOLBAR_CHIP =
  'h-9 min-w-0 flex-row items-center gap-1 rounded-[3px] border border-border bg-card px-2 active:bg-card-panel';

interface DeckVersionMenuProps {
  deck: DeckState;
  fill?: boolean;
}

export function DeckVersionMenu({ deck, fill = false }: DeckVersionMenuProps) {
  const isMobile = useMobileLayout();
  const saveStatus = useDeckSaveStatus(deck.id, deck.versionId);
  const { createVersion, renameVersion, deleteVersion, activateVersion } =
    useDeckVersions();
  const [open, setOpen] = useState(false);
  const [nameMode, setNameMode] = useState<'create' | 'rename' | null>(null);
  const [renameTarget, setRenameTarget] = useState<DeckVersionSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeckVersionSummary | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [pendingCreateName, setPendingCreateName] = useState<string | null>(null);

  const versions =
    deck.versions && deck.versions.length > 0
      ? deck.versions
      : deck.versionId
        ? [
            {
              id: deck.versionId,
              name: deck.versionName ?? 'Current',
              createdAt: deck.createdAt,
              updatedAt: deck.updatedAt,
              isActive: true,
            },
          ]
        : [];
  const canDelete = versions.length > 1;
  const versionLabel = deck.versionName ?? 'Current';
  const busy =
    createVersion.isPending ||
    renameVersion.isPending ||
    deleteVersion.isPending ||
    activateVersion.isPending;

  const closeMenu = useCallback(() => setOpen(false), []);

  const flushActive = useCallback(async (): Promise<boolean> => {
    try {
      await flushEditorDeckSave(deck);
      return true;
    } catch {
      return false;
    }
  }, [deck]);

  const switchTo = useCallback(
    async (versionId: string, skipFlush = false) => {
      if (versionId === deck.versionId) {
        closeMenu();
        return;
      }
      if (!skipFlush && !(await flushActive())) {
        closeMenu();
        setPendingSwitchId(versionId);
        return;
      }
      closeMenu();
      await activateVersion.mutateAsync({ deckId: deck.id, versionId });
    },
    [activateVersion, closeMenu, deck.id, deck.versionId, flushActive]
  );

  const createNamedVersion = useCallback(
    async (name: string, skipFlush = false) => {
      if (!skipFlush && !(await flushActive())) {
        setPendingCreateName(name);
        return;
      }
      await createVersion.mutateAsync({ deckId: deck.id, name });
    },
    [createVersion, deck.id, flushActive]
  );

  const retrySave = useCallback(() => {
    void flushEditorDeckSave(deck);
  }, [deck]);

  const openCreate = useCallback(() => {
    closeMenu();
    setRenameTarget(null);
    setNameMode('create');
  }, [closeMenu]);

  const openRename = useCallback(
    (version: DeckVersionSummary) => {
      closeMenu();
      setRenameTarget(version);
      setNameMode('rename');
    },
    [closeMenu]
  );

  const openDelete = useCallback(
    (version: DeckVersionSummary) => {
      closeMenu();
      setDeleteTarget(version);
    },
    [closeMenu]
  );

  const trigger = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Deck version ${versionLabel}`}
      accessibilityState={{ expanded: open }}
      className={cn(
        TOOLBAR_CHIP,
        fill && 'max-w-full flex-1',
        open && 'border-foreground'
      )}
      onPress={(event) => {
        event.stopPropagation?.();
        hapticPress();
        if (isMobile) setOpen((current) => !current);
      }}
    >
      <Text
        className="min-w-0 flex-1 text-[13px] font-medium text-foreground"
        numberOfLines={1}
      >
        {versionLabel}
      </Text>
      <ThemedIcon icon={ChevronDownIcon} size={14} color="muted-foreground" />
    </Pressable>
  );

  const list = (
    <DeckVersionList
      deck={deck}
      versions={versions}
      canDelete={canDelete}
      busy={busy}
      onSwitch={(versionId) => void switchTo(versionId)}
      onRename={openRename}
      onDelete={openDelete}
    />
  );

  const footer = (
    <Button className="w-full" disabled={busy} onPress={openCreate}>
      <ButtonText>New version</ButtonText>
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <View className={cn('min-w-0', fill && 'flex-1')}>
          {trigger}
          <AppSheet open={open} onOpenChange={setOpen}>
            <AppSheetPortal name="deck-versions">
              <AppSheetOverlay />
              <AppSheetContent snapPoints={['56%']}>
                <AppSheetHeader>
                  <AppSheetTitle>Versions</AppSheetTitle>
                </AppSheetHeader>
                <AppSheetScrollView>
                  <DeckVersionSaveStatus status={saveStatus} onRetry={retrySave} />
                  {list}
                </AppSheetScrollView>
                <AppSheetFooter>{footer}</AppSheetFooter>
              </AppSheetContent>
            </AppSheetPortal>
          </AppSheet>
        </View>
      ) : (
        <View className={cn('relative min-w-0', fill && 'flex-1')}>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverPortal>
              <PopoverOverlay className="bg-transparent" closeOnPress />
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={4}
                className="z-50 w-[18.5rem] overflow-hidden rounded-[3px] border border-border bg-popover p-1 shadow-none"
              >
                <DeckVersionSaveStatus status={saveStatus} onRetry={retrySave} />
                <ScrollView className="max-h-72">{list}</ScrollView>
                <View className="border-t border-border p-1 pt-1.5">{footer}</View>
              </PopoverContent>
            </PopoverPortal>
          </Popover>
        </View>
      )}

      <DeckVersionNameSheet
        open={nameMode != null}
        onOpenChange={(next) => {
          if (!next) {
            setNameMode(null);
            setRenameTarget(null);
          }
        }}
        title={nameMode === 'rename' ? 'Rename version' : 'New version'}
        description={
          nameMode === 'rename'
            ? 'Update the name of this list. Autosave still writes to it.'
            : 'Copy the current list into a new named version and switch to it.'
        }
        confirmLabel={nameMode === 'rename' ? 'Rename' : 'Save version'}
        initialName={nameMode === 'rename' ? (renameTarget?.name ?? '') : ''}
        onConfirm={async (name) => {
          if (nameMode === 'rename' && renameTarget) {
            await renameVersion.mutateAsync({
              deckId: deck.id,
              versionId: renameTarget.id,
              name,
            });
            return;
          }
          await createNamedVersion(name);
        }}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title="Delete version"
        description={
          deleteTarget ? `Delete “${deleteTarget.name}”? This cannot be undone.` : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteVersion.mutateAsync({
            deckId: deck.id,
            versionId: deleteTarget.id,
          });
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={pendingSwitchId != null}
        onOpenChange={(next) => {
          if (!next) setPendingSwitchId(null);
        }}
        title="Latest edits aren’t synced"
        description="Switch anyway? You can retry the save from the version menu later."
        confirmLabel="Switch anyway"
        cancelLabel="Stay"
        onConfirm={async () => {
          if (!pendingSwitchId) return;
          const versionId = pendingSwitchId;
          setPendingSwitchId(null);
          await switchTo(versionId, true);
        }}
      />

      <ConfirmDialog
        open={pendingCreateName != null}
        onOpenChange={(next) => {
          if (!next) setPendingCreateName(null);
        }}
        title="Latest edits aren’t synced"
        description="Create the version from the last saved list anyway?"
        confirmLabel="Create anyway"
        cancelLabel="Stay"
        onConfirm={async () => {
          if (!pendingCreateName) return;
          const name = pendingCreateName;
          setPendingCreateName(null);
          await createNamedVersion(name, true);
        }}
      />
    </>
  );
}

function DeckVersionList({
  deck,
  versions,
  canDelete,
  busy,
  onSwitch,
  onRename,
  onDelete,
}: {
  deck: DeckState;
  versions: DeckVersionSummary[];
  canDelete: boolean;
  busy: boolean;
  onSwitch: (versionId: string) => void;
  onRename: (version: DeckVersionSummary) => void;
  onDelete: (version: DeckVersionSummary) => void;
}) {
  return (
    <View className="gap-0.5">
      {versions.map((version) => {
        const active = version.id === deck.versionId || version.isActive;
        return (
          <View
            key={version.id}
            className={cn(
              'flex-row items-center gap-1 rounded-[3px] px-1.5 py-1.5',
              active && 'bg-card-panel'
            )}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${version.name}`}
              accessibilityState={{ selected: active, disabled: busy }}
              disabled={busy}
              className="min-w-0 flex-1 flex-row items-center gap-2"
              onPress={() => {
                hapticPress();
                onSwitch(version.id);
              }}
            >
              <View className="size-4 items-center justify-center">
                {active ? (
                  <ThemedIcon icon={CheckIcon} size={14} color="foreground" />
                ) : null}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm text-popover-foreground" numberOfLines={1}>
                  {version.name}
                </Text>
                <Text className="font-mono text-[11px] text-muted-foreground">
                  {formatVersionUpdatedAt(version.updatedAt)}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rename ${version.name}`}
              disabled={busy}
              className="size-8 items-center justify-center rounded-[3px] active:bg-card"
              onPress={() => {
                hapticPress();
                onRename(version);
              }}
            >
              <ThemedIcon icon={PencilIcon} size={14} color="muted-foreground" />
            </Pressable>
            {canDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${version.name}`}
                disabled={busy}
                className="size-8 items-center justify-center rounded-[3px] active:bg-destructive/10"
                onPress={() => {
                  hapticPress();
                  onDelete(version);
                }}
              >
                <ThemedIcon icon={TrashIcon} size={14} color="muted-foreground" />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function DeckVersionSaveStatus({
  status,
  onRetry,
}: {
  status: DeckSaveStatus;
  onRetry: () => void;
}) {
  if (status.state === 'error') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry save"
        className="flex-row items-center gap-2 rounded-[3px] px-2 py-1.5 active:bg-card-panel"
        onPress={() => {
          hapticPress();
          onRetry();
        }}
      >
        <ThemedIcon icon={CloudOffIcon} size={14} color="foreground" />
        <Text className="flex-1 text-xs font-medium text-destructive">
          Couldn’t save
        </Text>
        <Text className="text-xs font-medium text-foreground">Retry</Text>
      </Pressable>
    );
  }

  const label =
    status.state === 'saving'
      ? 'Saving…'
      : status.state === 'saved'
        ? 'Saved'
        : 'Autosave on';

  return (
    <View className="flex-row items-center gap-2 px-2 py-1.5">
      <ThemedIcon
        icon={status.state === 'saved' ? CheckIcon : CloudUploadIcon}
        size={14}
        color="muted-foreground"
      />
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
    </View>
  );
}
