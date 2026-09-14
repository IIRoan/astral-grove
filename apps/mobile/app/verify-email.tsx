import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AuthSlabCorners } from '@/components/auth/AuthArtifacts';
import { EmailVerificationForm } from '@/components/auth/EmailVerificationForm';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { isLikelyMobileUserAgent } from '@/lib/collection-invite-link';
import { parseVerificationSearchParams } from '@/lib/email-verification';
import { migrateLocalCollectionToRemote } from '@/services/collectionService';
import { invalidateUserDataQueries } from '@/src/api/queryClient';
import { authClient } from '@/src/lib/auth-client';
import { FORM_COLUMN_CLASS } from '@/lib/responsive-layout';

function readBrowserUserAgent(): string {
  if (Platform.OS !== 'web') return '';
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent ?? '';
}

function buildNativeVerifyDeepLink(email: string, otp: string): string {
  const params = new URLSearchParams({ email, otp });
  return `astral-grove://verify-email?${params.toString()}`;
}

/** HTTPS / deep-link email verification landing; opens the app when possible, else verifies OTP in-place. */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ email?: string; otp?: string }>();
  const parsed = parseVerificationSearchParams(params);
  const [attemptedAppOpen, setAttemptedAppOpen] = useState(false);

  const onNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const onWeb = Platform.OS === 'web';
  const mobileBrowser = onWeb && isLikelyMobileUserAgent(readBrowserUserAgent());
  const deepLink =
    parsed && !onNative ? buildNativeVerifyDeepLink(parsed.email, parsed.otp) : null;

  useEffect(() => {
    if (!parsed || !deepLink || !mobileBrowser) return;
    window.location.href = deepLink;
    setAttemptedAppOpen(true);
  }, [parsed, deepLink, mobileBrowser]);

  if (!parsed) {
    return (
      <ScreenLayout contentClassName={FORM_COLUMN_CLASS}>
        <ScreenHeader title="Verify email" />
        <Text className="mt-4 text-sm text-muted-foreground">
          This verification link is missing or invalid. Request a new one from sign-in.
        </Text>
        <Button
          className="mt-4"
          onPress={() => {
            router.replace('/' as Href);
          }}
        >
          <ButtonText>Back to app</ButtonText>
        </Button>
      </ScreenLayout>
    );
  }

  if (onWeb && mobileBrowser) {
    return (
      <ScreenLayout contentClassName={FORM_COLUMN_CLASS}>
        <ScreenHeader title="Verify email" />
        <View className="mt-4 gap-4">
          <Text className="text-base text-foreground">
            {attemptedAppOpen
              ? 'Opening The Astral Grove…'
              : 'This verification opens in The Astral Grove.'}
          </Text>
          <Text className="text-sm text-muted-foreground">
            If the app does not open, continue below to verify in the browser.
          </Text>
          {deepLink ? (
            <Button
              onPress={() => {
                void Linking.openURL(deepLink);
              }}
            >
              <ButtonText
                className="shrink py-2 text-center whitespace-normal"
                numberOfLines={2}
              >
                Open in The Astral Grove
              </ButtonText>
            </Button>
          ) : null}
          <View className="relative mt-2 rounded-[10px] border border-border bg-card px-4 py-4">
            <AuthSlabCorners />
            <EmailVerificationForm
              email={parsed.email}
              initialOtp={parsed.otp}
              autoSubmit={false}
              onVerified={async () => {
                await authClient.getSession();
                await migrateLocalCollectionToRemote();
                await invalidateUserDataQueries(queryClient);
                router.replace('/' as Href);
              }}
            />
          </View>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout contentClassName={FORM_COLUMN_CLASS}>
      <ScreenHeader title="Verify email" />
      <View className="relative mt-4 rounded-[10px] border border-border bg-card px-4 py-4">
        <AuthSlabCorners />
        <EmailVerificationForm
          email={parsed.email}
          initialOtp={parsed.otp}
          autoSubmit
          onVerified={async () => {
            await authClient.getSession();
            await migrateLocalCollectionToRemote();
            await invalidateUserDataQueries(queryClient);
            router.replace('/' as Href);
          }}
        />
      </View>
    </ScreenLayout>
  );
}
