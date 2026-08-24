import * as Clipboard from 'expo-clipboard';
import { Alert, Platform, Pressable, View } from 'react-native';
import { AuthSlabCorners } from '@/components/auth/AuthArtifacts';
import { Button, ButtonText } from '@/components/ui/button';
import { toast } from '@/components/ui/toast.api';
import { Text } from '@/components/ui/text';
import { UserBlobatar } from '@/components/ui/user-blobatar';
import {
  useCollectionShareMutations,
  useCollectionShareStatus,
} from '@/hooks/useCollectionShare';
import { cn } from '@/lib/utils';
import { authClient } from '@/src/lib/auth-client';
import { RemoteApiError } from '@/src/api/authedClient';

function confirmAction(title: string, message: string, onConfirm: () => void): void {
  if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
    if (globalThis.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

async function copyInviteLink(url: string): Promise<void> {
  await Clipboard.setStringAsync(url);
  toast.success('Invite link copied');
}

type SharedCollectionSectionProps = {
  className?: string;
};

export function SharedCollectionSection({ className }: SharedCollectionSectionProps) {
  const sessionQuery = authClient.useSession();
  const signedIn = Boolean(sessionQuery.data?.user);
  const statusQuery = useCollectionShareStatus(signedIn);
  const { createInvite, revokeInvite, leave } = useCollectionShareMutations();

  if (!signedIn) {
    return null;
  }

  const status = statusQuery.data;
  const pendingInvite = status?.pendingInvite;
  const pendingUrl = pendingInvite?.url;
  const invitePending = Boolean(pendingInvite);
  const busy =
    createInvite.isPending ||
    revokeInvite.isPending ||
    leave.isPending ||
    statusQuery.isLoading;

  const onCopyOrCreate = () => {
    if (pendingUrl) {
      void copyInviteLink(pendingUrl).catch(() => {
        Alert.alert('Invite link', pendingUrl);
      });
      return;
    }

    createInvite.mutate(undefined, {
      onSuccess: (invite) => {
        void copyInviteLink(invite.url).catch(() => {
          Alert.alert('Invite link', invite.url);
        });
      },
      onError: (error) => {
        const message =
          error instanceof RemoteApiError
            ? error.body || error.message
            : 'Could not create invite';
        Alert.alert('Invite failed', message);
      },
    });
  };

  const onLeave = () => {
    confirmAction(
      'Leave shared collection',
      'You will start a new empty personal collection. Your partner keeps the shared list. Export first if you want a copy of the cards.',
      () => {
        leave.mutate(undefined, {
          onError: (error) => {
            const message =
              error instanceof RemoteApiError
                ? error.body || error.message
                : 'Could not leave shared collection';
            Alert.alert('Leave failed', message);
          },
        });
      }
    );
  };

  const onCancelInvite = () => {
    revokeInvite.mutate(undefined, {
      onSuccess: () => {
        toast.success('Invite cancelled');
      },
      onError: () => {
        Alert.alert('Cancel failed', 'Could not cancel invite');
      },
    });
  };

  if (statusQuery.isError) {
    return (
      <View
        className={cn(
          'justify-center rounded-[10px] border border-border bg-card px-4 py-4',
          className
        )}
      >
        <Text className="text-sm text-muted-foreground">
          Could not load share status.
        </Text>
      </View>
    );
  }

  if (status?.shared && status.partner) {
    return (
      <View
        className={cn(
          'relative overflow-hidden rounded-[10px] border border-border bg-card',
          className
        )}
      >
        <AuthSlabCorners />
        <View className="min-h-0 flex-1 flex-row items-stretch">
          <View className="w-[76px] items-center justify-center border-r border-border bg-background py-6">
            <UserBlobatar
              userId={status.partner.userId}
              title={status.partner.name}
              size={48}
              framed
            />
          </View>
          <View className="min-w-0 flex-1 justify-between gap-4 px-4 py-4">
            <View className="gap-1">
              <Text
                className="text-lg font-normal tracking-tight text-foreground"
                numberOfLines={1}
              >
                {status.partner.name}
              </Text>
              <Text
                className="font-mono text-[12px] text-muted-foreground"
                numberOfLines={1}
              >
                {status.partner.email}
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Same cards. Decks stay separate.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onLeave}
              className="self-start rounded-[3px] border border-border px-3 py-2 active:bg-card-panel"
            >
              <Text className="text-sm font-medium text-foreground">Leave share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={cn(
        'relative justify-between gap-4 overflow-hidden rounded-[10px] border border-border bg-card px-4 py-4',
        className
      )}
    >
      <AuthSlabCorners />
      <View className="gap-1">
        <Text className="text-lg font-normal tracking-tight text-foreground">
          Invite a partner
        </Text>
        <Text className="text-sm text-muted-foreground">
          One shared collection. Decks and wishlists stay personal.
        </Text>
      </View>

      {invitePending ? (
        <View className="gap-3">
          {pendingUrl ? (
            <View className="gap-2 rounded-[3px] border border-border bg-card-panel px-3 py-3">
              <Text className="text-[10px] font-normal uppercase tracking-[1.6px] text-muted-foreground">
                Invite link
              </Text>
              <Text className="font-mono text-sm leading-5 text-foreground" selectable>
                {pendingUrl}
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground">
              An invite is pending. Create a new link to copy it again — that replaces
              the old one.
            </Text>
          )}
          <View className="flex-row items-center gap-3">
            <Button
              size="sm"
              disabled={busy}
              onPress={onCopyOrCreate}
              className="flex-1"
            >
              <ButtonText>{pendingUrl ? 'Copy link' : 'Create new link'}</ButtonText>
            </Button>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancelInvite}
              className="px-2 py-2 active:opacity-70"
            >
              <Text className="text-sm text-muted-foreground">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Button disabled={busy} onPress={onCopyOrCreate} className="self-start">
          <ButtonText>
            {createInvite.isPending ? 'Creating…' : 'Create invite link'}
          </ButtonText>
        </Button>
      )}
    </View>
  );
}
