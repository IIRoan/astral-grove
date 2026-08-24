import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { AuthGate } from '@/components/auth/AuthGate';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { UserBlobatar } from '@/components/ui/user-blobatar';
import {
  useCollectionShareInvitePreview,
  useCollectionShareMutations,
} from '@/hooks/useCollectionShare';
import { RemoteApiError } from '@/src/api/authedClient';
import { authClient } from '@/src/lib/auth-client';
import type { CollectionShareAcceptMode } from '@riftbound/contracts';

function confirmMode(
  mode: CollectionShareAcceptMode,
  yourQty: number,
  onConfirm: () => void
) {
  if (mode === 'merge') {
    onConfirm();
    return;
  }
  const title = 'Use their collection?';
  const message =
    yourQty > 0
      ? `This discards your ${yourQty.toLocaleString()} cards and keeps only their inventory.`
      : 'You will join their collection as-is.';

  if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
    if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Use theirs', style: 'destructive', onPress: onConfirm },
  ]);
}

function InviteAcceptBody({ token }: { token: string }) {
  const router = useRouter();
  const sessionQuery = authClient.useSession();
  const previewQuery = useCollectionShareInvitePreview(token);
  const { acceptInvite } = useCollectionShareMutations();
  const [submitting, setSubmitting] = useState<CollectionShareAcceptMode | null>(null);

  const preview = previewQuery.data;
  const sessionUserId = sessionQuery.data?.user?.id;
  const isOwnInvite = Boolean(
    preview && sessionUserId && preview.inviter.userId === sessionUserId
  );

  const onAccept = (mode: CollectionShareAcceptMode) => {
    if (!preview?.canAccept || isOwnInvite) return;
    const run = () => {
      setSubmitting(mode);
      acceptInvite.mutate(
        { token, mode },
        {
          onSuccess: () => {
            router.replace('/(tabs)/collection');
          },
          onError: (error) => {
            setSubmitting(null);
            const message =
              error instanceof RemoteApiError
                ? error.body || error.message
                : 'Could not accept invite';
            Alert.alert('Accept failed', message);
          },
          onSettled: () => {
            setSubmitting(null);
          },
        }
      );
    };

    confirmMode(mode, preview.yourTotalQuantity, run);
  };

  return (
    <ScreenLayout>
      <ScreenHeader title="Join collection" />

      {previewQuery.isLoading ? (
        <Text className="mt-4 text-sm text-muted-foreground">Loading invite…</Text>
      ) : null}

      {previewQuery.isError ? (
        <Text className="mt-4 text-sm text-muted-foreground">
          This invite is invalid or has expired.
        </Text>
      ) : null}

      {preview && isOwnInvite ? (
        <View className="mt-4 gap-3 rounded-[10px] border border-border bg-card px-4 py-4">
          <Text className="text-base font-medium text-foreground">
            This is your invite
          </Text>
          <Text className="text-sm text-muted-foreground">
            You can’t join your own shared collection. Send the link to your partner
            instead.
          </Text>
          <Button
            variant="outline"
            onPress={() => {
              router.replace('/(tabs)/settings');
            }}
          >
            <ButtonText>Back to settings</ButtonText>
          </Button>
        </View>
      ) : null}

      {preview && !isOwnInvite ? (
        <View className="mt-4 gap-4">
          <View className="flex-row items-center gap-3">
            <UserBlobatar
              userId={preview.inviter.userId}
              title={preview.inviter.name}
              size={48}
              framed
            />
            <Text className="min-w-0 flex-1 text-base text-foreground">
              {preview.inviter.name} invited you to share a collection.
            </Text>
          </View>

          <View className="gap-1 rounded-[10px] border border-border bg-card px-4 py-3">
            <Text className="text-sm font-medium text-foreground">
              Their collection
            </Text>
            <Text className="text-sm text-muted-foreground">
              {preview.theirItemCount.toLocaleString()} stacks ·{' '}
              {preview.theirTotalQuantity.toLocaleString()} cards
            </Text>
          </View>

          <View className="gap-1 rounded-[10px] border border-border bg-card px-4 py-3">
            <Text className="text-sm font-medium text-foreground">Your collection</Text>
            <Text className="text-sm text-muted-foreground">
              {preview.yourItemCount.toLocaleString()} stacks ·{' '}
              {preview.yourTotalQuantity.toLocaleString()} cards
            </Text>
          </View>

          {!preview.canAccept ? (
            <Text className="text-sm text-muted-foreground">
              {preview.reason ?? 'You cannot accept this invite.'}
            </Text>
          ) : (
            <View className="gap-3">
              <Text className="text-sm text-muted-foreground">
                Choose how to combine inventories. Decks stay separate either way.
              </Text>
              <Button
                disabled={Boolean(submitting)}
                onPress={() => {
                  onAccept('use_theirs');
                }}
              >
                <ButtonText>
                  {submitting === 'use_theirs' ? 'Joining…' : 'Use their collection'}
                </ButtonText>
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(submitting)}
                onPress={() => {
                  onAccept('merge');
                }}
              >
                <ButtonText>
                  {submitting === 'merge' ? 'Merging…' : 'Merge both (sum quantities)'}
                </ButtonText>
              </Button>
            </View>
          )}
        </View>
      ) : null}
    </ScreenLayout>
  );
}

export default function CollectionInviteScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : undefined;

  if (!token) {
    return (
      <ScreenLayout>
        <ScreenHeader title="Join collection" />
        <Text className="mt-4 text-sm text-muted-foreground">
          Missing invite token.
        </Text>
      </ScreenLayout>
    );
  }

  return (
    <AuthGate>
      <InviteAcceptBody token={token} />
    </AuthGate>
  );
}
