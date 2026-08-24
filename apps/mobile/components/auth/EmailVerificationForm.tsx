import { useEffect, useId, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { Button, ButtonText } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import {
  EMAIL_VERIFICATION_OTP_LENGTH,
  isCompleteVerificationOtp,
  normalizeVerificationEmail,
  normalizeVerificationOtp,
} from '@/lib/email-verification';
import { authClient } from '@/src/lib/auth-client';

type EmailVerificationFormProps = {
  email: string;
  onVerified: () => Promise<void> | void;
  onChangeEmail?: () => void;
  className?: string;
  initialOtp?: string;
  autoSubmit?: boolean;
  /** Send OTP on mount for settings/restore only — not after sign-up/sign-in (already sent). */
  autoSendOnMount?: boolean;
  compact?: boolean;
  submitLabel?: string;
};

export function EmailVerificationForm({
  email,
  onVerified,
  onChangeEmail,
  className,
  initialOtp = '',
  autoSubmit = false,
  autoSendOnMount = false,
  compact = false,
  submitLabel = 'Verify and continue',
}: EmailVerificationFormProps) {
  const labelId = useId();
  const normalizedEmail = normalizeVerificationEmail(email);
  const [otp, setOtp] = useState(initialOtp);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const autoTriedRef = useRef(false);
  const autoSentRef = useRef(false);

  const verify = async (nextOtp: string) => {
    const code = normalizeVerificationOtp(nextOtp);
    if (!isCompleteVerificationOtp(code)) {
      setError(
        `Enter the ${String(EMAIL_VERIFICATION_OTP_LENGTH)}-digit code from your email`
      );
      return;
    }
    Keyboard.dismiss();
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: normalizedEmail,
        otp: code,
      });
      if (result.error) {
        setError(result.error.message ?? 'Verification failed');
        return;
      }
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setResendNote(null);
      setError(null);
    }
    setResendBusy(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: 'email-verification',
      });
      if (result.error) {
        setError(result.error.message ?? 'Could not resend code');
        return;
      }
      if (!opts?.silent) {
        setResendNote('A new code and link are on the way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setResendBusy(false);
    }
  };

  useEffect(() => {
    if (!autoSubmit || autoTriedRef.current) return;
    if (!isCompleteVerificationOtp(initialOtp)) return;
    autoTriedRef.current = true;
    void verify(initialOtp);
  }, [autoSubmit, initialOtp]);

  useEffect(() => {
    if (!autoSendOnMount || autoSentRef.current || !normalizedEmail) return;
    autoSentRef.current = true;
    void resend({ silent: true });
  }, [autoSendOnMount, normalizedEmail]);

  return (
    <View className={className}>
      <View className="gap-2">
        <Text
          className={
            compact
              ? 'text-lg font-semibold tracking-tight text-foreground'
              : 'text-xl font-semibold tracking-tight text-foreground'
          }
        >
          Check your email
        </Text>
        <Text className="text-sm leading-5 text-muted-foreground">
          {compact ? (
            <>
              Enter the {String(EMAIL_VERIFICATION_OTP_LENGTH)}-digit code we sent to{' '}
              <Text className="font-medium text-foreground">{normalizedEmail}</Text>.
            </>
          ) : (
            <>
              We sent a verification link and a {String(EMAIL_VERIFICATION_OTP_LENGTH)}
              -digit code to{' '}
              <Text className="font-medium text-foreground">{normalizedEmail}</Text>.
              Open the link, or enter the code below.
            </>
          )}
        </Text>
      </View>

      <View className="mt-5 gap-2">
        <Label nativeID={labelId}>Verification code</Label>
        <TextInput
          value={otp}
          onChangeText={(value) => {
            setOtp(
              normalizeVerificationOtp(value).slice(0, EMAIL_VERIFICATION_OTP_LENGTH)
            );
            setError(null);
          }}
          disabled={busy}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={EMAIL_VERIFICATION_OTP_LENGTH}
          returnKeyType="go"
          submitBehavior="submit"
          placeholder={'0'.repeat(EMAIL_VERIFICATION_OTP_LENGTH)}
          accessibilityLabel="Verification code"
          accessibilityLabelledBy={labelId}
          className="font-mono tracking-[0.35em]"
          onSubmitEditing={() => {
            void verify(otp);
          }}
        />
      </View>

      {error ? (
        <View className="mt-4 rounded-[3px] border border-destructive/30 bg-destructive/10 px-3 py-2.5">
          <Text
            className="text-sm text-destructive"
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        </View>
      ) : null}

      {resendNote ? (
        <Text
          className="mt-3 text-sm text-muted-foreground"
          accessibilityLiveRegion="polite"
        >
          {resendNote}
        </Text>
      ) : null}

      <Button
        className="mt-5"
        onPress={() => {
          void verify(otp);
        }}
        disabled={busy || !isCompleteVerificationOtp(otp)}
        busy={busy}
        size="lg"
      >
        <ButtonText>{submitLabel}</ButtonText>
      </Button>

      <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || resendBusy}
          busy={resendBusy}
          onPress={() => {
            void resend();
          }}
        >
          <ButtonText>Resend email</ButtonText>
        </Button>
        {onChangeEmail ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || resendBusy}
            onPress={onChangeEmail}
          >
            <ButtonText>Use a different email</ButtonText>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
