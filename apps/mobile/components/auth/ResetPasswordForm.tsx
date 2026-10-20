import { useId, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { PasswordRequirementsIndicator } from '@/components/auth/PasswordRequirementsIndicator';
import {
  MIN_PASSWORD_LENGTH,
  signUpPasswordIssues,
} from '@/components/auth/password-requirements';
import { Button, ButtonText } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { authClient } from '@/src/lib/auth-client';

type ResetPasswordFormProps = {
  token: string;
  onSuccess: () => Promise<void> | void;
  onBackToSignIn?: () => void;
  className?: string;
  submitLabel?: string;
};

export function ResetPasswordForm({
  token,
  onSuccess,
  onBackToSignIn,
  className,
  submitLabel = 'Save and continue',
}: ResetPasswordFormProps) {
  const labelId = useId();
  const confirmId = useId();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    Keyboard.dismiss();
    setError(null);
    const issues = signUpPasswordIssues(password);
    if (issues.length > 0) {
      setError(`Password needs: ${issues.join(', ').toLowerCase()}`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError(result.error.message ?? 'Could not reset password');
        return;
      }

      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className={className}>
      <View className="gap-2">
        <Text className="text-xl font-semibold tracking-tight text-foreground">
          Choose a new password
        </Text>
        <Text className="text-sm leading-5 text-muted-foreground">
          Use at least {String(MIN_PASSWORD_LENGTH)} characters with lower, upper, and a
          number.
        </Text>
      </View>

      <View className="mt-5 gap-4">
        <View className="gap-2">
          <Label nativeID={labelId}>New password</Label>
          <TextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError(null);
            }}
            disabled={busy}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete={Platform.OS === 'web' ? 'new-password' : 'password-new'}
            textContentType="newPassword"
            passwordRules={`minlength: ${String(MIN_PASSWORD_LENGTH)}; required: lower; required: upper; required: digit;`}
            returnKeyType="next"
            accessibilityLabel="New password"
            accessibilityLabelledBy={labelId}
          />
          <PasswordRequirementsIndicator password={password} />
        </View>

        <View className="gap-2">
          <Label nativeID={confirmId}>Confirm password</Label>
          <TextInput
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              setError(null);
            }}
            disabled={busy}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete={Platform.OS === 'web' ? 'new-password' : 'password-new'}
            textContentType="newPassword"
            returnKeyType="go"
            submitBehavior="submit"
            accessibilityLabel="Confirm password"
            accessibilityLabelledBy={confirmId}
            onSubmitEditing={() => {
              void submit();
            }}
          />
        </View>

        {error ? (
          <View className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <Text
              className="text-sm text-destructive"
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          </View>
        ) : null}

        <Button
          className="mt-1"
          onPress={() => {
            void submit();
          }}
          disabled={busy}
          busy={busy}
          size="lg"
        >
          <ButtonText>{submitLabel}</ButtonText>
        </Button>

        {onBackToSignIn ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={onBackToSignIn}
            className="self-start"
          >
            <ButtonText>Back to sign in</ButtonText>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
