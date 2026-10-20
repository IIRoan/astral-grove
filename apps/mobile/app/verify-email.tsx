import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EmailVerificationForm } from '@/components/auth/EmailVerificationForm';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { parseVerificationSearchParams } from '@/lib/email-verification';
import { FORM_COLUMN_CLASS } from '@/lib/responsive-layout';
import { authClient } from '@/src/lib/auth-client';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    otp?: string;
    token?: string;
  }>();
  const parsed = parseVerificationSearchParams(params);
  const [verified, setVerified] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmLink = async (email: string, token: string) => {
    setBusy(true);
    setLinkError(null);
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: token });
      if (result.error) {
        setLinkError(
          result.error.message ?? 'This link has expired. Enter the code instead.'
        );
        return;
      }
      setVerified(true);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenLayout contentClassName={FORM_COLUMN_CLASS}>
      <ScreenHeader title="Verify email" />
      {parsed && !verified && parsed.token && !linkError ? (
        <View className="mt-4 gap-4 rounded-[10px] border border-border bg-card px-4 py-4">
          <Text className="text-muted-foreground">
            Confirm <Text className="font-medium text-foreground">{parsed.email}</Text>{' '}
            for The Astral Grove.
          </Text>
          <Button
            busy={busy}
            disabled={busy}
            size="lg"
            onPress={() => {
              void confirmLink(parsed.email, parsed.token);
            }}
          >
            <ButtonText>Verify email</ButtonText>
          </Button>
        </View>
      ) : parsed && !verified ? (
        <View className="mt-4 rounded-[10px] border border-border bg-card px-4 py-4">
          {linkError ? (
            <Text className="mb-4 text-sm text-destructive" accessibilityRole="alert">
              {linkError}
            </Text>
          ) : null}
          <EmailVerificationForm
            email={parsed.email}
            initialOtp={parsed.otp}
            onVerified={() => setVerified(true)}
          />
        </View>
      ) : (
        <View className="mt-4 gap-4">
          <Text className="text-muted-foreground">
            {verified
              ? 'Email verified. You can now sign in to The Astral Grove.'
              : 'This verification link is missing or invalid. Request a new one from sign-in.'}
          </Text>
          <Button onPress={() => router.replace('/' as Href)}>
            <ButtonText>Back to app</ButtonText>
          </Button>
        </View>
      )}
    </ScreenLayout>
  );
}
