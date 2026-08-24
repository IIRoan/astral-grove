import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AuthPlaymat } from '@/components/auth/AuthPlaymat';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { isLikelyMobileUserAgent } from '@/lib/collection-invite-link';
import {
  buildPasswordResetDeepLink,
  parsePasswordResetSearchParams,
} from '@/lib/password-reset';
import { migrateLocalCollectionToRemote } from '@/services/collectionService';
import { invalidateUserDataQueries } from '@/src/api/queryClient';
import { authClient } from '@/src/lib/auth-client';

function readBrowserUserAgent(): string {
  if (Platform.OS !== 'web') return '';
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent ?? '';
}

function ResetPasswordMessage({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View className="gap-5">
      <View className="gap-2">
        <Text className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </Text>
        <Text className="text-sm leading-5 text-muted-foreground">{body}</Text>
      </View>
      <Button size="lg" onPress={onAction}>
        <ButtonText>{actionLabel}</ButtonText>
      </Button>
    </View>
  );
}

/** HTTPS / deep-link landing for password reset — same playmat as sign-in. */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    token?: string;
    email?: string;
    error?: string;
  }>();
  const parsed = parsePasswordResetSearchParams(params);
  const [attemptedAppOpen, setAttemptedAppOpen] = useState(false);

  const onNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const onWeb = Platform.OS === 'web';
  const mobileBrowser = onWeb && isLikelyMobileUserAgent(readBrowserUserAgent());
  const token = parsed && 'token' in parsed ? parsed.token : null;
  const email = parsed && 'token' in parsed ? parsed.email : null;
  const deepLink =
    token && !onNative
      ? buildPasswordResetDeepLink({ token, ...(email ? { email } : {}) })
      : null;

  useEffect(() => {
    if (!token || !deepLink || !mobileBrowser) return;
    window.location.href = deepLink;
    setAttemptedAppOpen(true);
  }, [token, deepLink, mobileBrowser]);

  const goHome = () => {
    router.replace('/' as Href);
  };

  const finishReset = async () => {
    await authClient.getSession();
    await migrateLocalCollectionToRemote();
    await invalidateUserDataQueries(queryClient);
    router.replace('/' as Href);
  };

  let body: React.ReactNode;

  if (parsed && 'error' in parsed) {
    body = (
      <ResetPasswordMessage
        title="Link expired"
        body="This reset link is invalid or expired. Request a new one from sign-in."
        actionLabel="Back to sign in"
        onAction={goHome}
      />
    );
  } else if (!token) {
    body = (
      <ResetPasswordMessage
        title="Missing reset link"
        body="This reset link is missing or invalid. Request a new one from sign-in."
        actionLabel="Back to sign in"
        onAction={goHome}
      />
    );
  } else if (onWeb && mobileBrowser) {
    body = (
      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-xl font-semibold tracking-tight text-foreground">
            Reset password
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {attemptedAppOpen
              ? 'Opening The Astral Grove…'
              : 'This reset opens in The Astral Grove.'}{' '}
            If the app does not open, continue below.
          </Text>
        </View>
        {deepLink ? (
          <Button
            onPress={() => {
              void Linking.openURL(deepLink);
            }}
          >
            <ButtonText>Open in The Astral Grove</ButtonText>
          </Button>
        ) : null}
        <ResetPasswordForm
          token={token}
          email={email}
          onBackToSignIn={goHome}
          onSuccess={finishReset}
        />
      </View>
    );
  } else {
    body = (
      <ResetPasswordForm
        token={token}
        email={email}
        onBackToSignIn={goHome}
        onSuccess={finishReset}
      />
    );
  }

  return <AuthPlaymat mode="sign-in">{body}</AuthPlaymat>;
}
