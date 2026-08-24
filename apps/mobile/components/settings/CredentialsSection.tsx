import { useId, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AuthSlabCorners } from '@/components/auth/AuthArtifacts';
import { PasswordRequirementsIndicator } from '@/components/auth/PasswordRequirementsIndicator';
import {
  MIN_PASSWORD_LENGTH,
  signUpPasswordIssues,
} from '@/components/auth/password-requirements';
import { ChevronDownIcon, CircleCheckIcon } from '@/components/icons';
import { Button, ButtonText } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SmoothChevron, SmoothCollapse } from '@/components/ui/smooth-collapse';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { toast } from '@/components/ui/toast.api';
import { useEmailVerificationRequired } from '@/hooks/useEmailVerificationRequired';
import {
  EMAIL_VERIFICATION_OTP_LENGTH,
  isCompleteVerificationOtp,
  normalizeVerificationEmail,
  normalizeVerificationOtp,
} from '@/lib/email-verification';
import { resolvePasswordResetRedirectTo } from '@/lib/password-reset';
import { cn } from '@/lib/utils';
import { invalidateUserDataQueries } from '@/src/api/queryClient';
import { authClient } from '@/src/lib/auth-client';

type CredentialsSectionProps = {
  className?: string;
};

type Editor = 'email' | 'password' | null;

const TRIGGER_CLASS =
  'h-12 flex-row items-center justify-between px-6 active:bg-card-panel';
const CONTENT_CLASS = 'border-t border-border px-6 pt-4 pb-10';

function CredentialsExpand({
  title,
  open,
  onToggle,
  divider,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className={cn(divider && 'border-t border-border')}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={onToggle}
        className={TRIGGER_CLASS}
      >
        <Text className="text-sm font-medium text-foreground">{title}</Text>
        <SmoothChevron open={open}>
          <ChevronDownIcon className="size-4 text-muted-foreground" weight="bold" />
        </SmoothChevron>
      </Pressable>
      <SmoothCollapse open={open}>
        <View className={CONTENT_CLASS}>{children}</View>
      </SmoothCollapse>
    </View>
  );
}

export function CredentialsSection({ className }: CredentialsSectionProps) {
  const queryClient = useQueryClient();
  const sessionQuery = authClient.useSession();
  const user = sessionQuery.data?.user;
  const mailEnabled = useEmailVerificationRequired().data === true;

  const [editor, setEditor] = useState<Editor>(null);

  const emailId = useId();
  const otpId = useId();
  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();

  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailAwaitingOtp, setEmailAwaitingOtp] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResendBusy, setEmailResendBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNote, setPasswordNote] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  if (!user) {
    return null;
  }

  const email = normalizeVerificationEmail(user.email);
  const verified = user.emailVerified === true;

  const resetEmailForm = () => {
    setNewEmail('');
    setEmailOtp('');
    setEmailAwaitingOtp(false);
    setEmailError(null);
    setEmailNote(null);
  };

  const toggleEditor = (next: Editor) => {
    if (editor === next) {
      if (next === 'email') resetEmailForm();
      setEditor(null);
      return;
    }
    if (editor === 'email') resetEmailForm();
    setEditor(next);
  };

  const requestEmailChange = async () => {
    Keyboard.dismiss();
    setEmailError(null);
    setEmailNote(null);
    const normalized = normalizeVerificationEmail(newEmail);
    if (!normalized.includes('@')) {
      setEmailError('Enter a valid email address');
      return;
    }
    if (normalized === email) {
      setEmailError('That is already your sign-in email');
      return;
    }
    setEmailBusy(true);
    try {
      const result = await authClient.emailOtp.requestEmailChange({
        newEmail: normalized,
      });
      if (result.error) {
        setEmailError(result.error.message ?? 'Could not send verification code');
        return;
      }
      setNewEmail(normalized);
      setEmailAwaitingOtp(true);
      setEmailNote(
        'If that address can receive mail, a verification code is on the way.'
      );
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : 'Could not send verification code'
      );
    } finally {
      setEmailBusy(false);
    }
  };

  const confirmEmailChange = async () => {
    Keyboard.dismiss();
    setEmailError(null);
    setEmailNote(null);
    const normalized = normalizeVerificationEmail(newEmail);
    const code = normalizeVerificationOtp(emailOtp);
    if (!isCompleteVerificationOtp(code)) {
      setEmailError(
        `Enter the ${String(EMAIL_VERIFICATION_OTP_LENGTH)}-digit code from your email`
      );
      return;
    }
    setEmailBusy(true);
    try {
      const result = await authClient.emailOtp.changeEmail({
        newEmail: normalized,
        otp: code,
      });
      if (result.error) {
        setEmailError(result.error.message ?? 'Could not verify and change email');
        return;
      }
      resetEmailForm();
      setEditor(null);
      await sessionQuery.refetch();
      await invalidateUserDataQueries(queryClient);
      toast.success('Email updated and verified');
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : 'Could not verify and change email'
      );
    } finally {
      setEmailBusy(false);
    }
  };

  const resendEmailChange = async () => {
    setEmailError(null);
    setEmailResendBusy(true);
    try {
      const result = await authClient.emailOtp.requestEmailChange({
        newEmail: normalizeVerificationEmail(newEmail),
      });
      if (result.error) {
        setEmailError(result.error.message ?? 'Could not resend code');
        return;
      }
      setEmailNote('A new verification code is on the way.');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setEmailResendBusy(false);
    }
  };

  const changePassword = async () => {
    Keyboard.dismiss();
    setPasswordError(null);
    setPasswordNote(null);
    if (currentPassword.length === 0) {
      setPasswordError('Enter your current password');
      return;
    }
    const issues = signUpPasswordIssues(newPassword);
    if (issues.length > 0) {
      setPasswordError(`New password needs: ${issues.join(', ').toLowerCase()}`);
      return;
    }
    if (newPassword !== confirm) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setPasswordError(result.error.message ?? 'Could not change password');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setPasswordNote('Password updated. Other sessions were signed out.');
      toast.success('Password updated');
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Could not change password'
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const sendResetLink = async () => {
    setPasswordError(null);
    setPasswordNote(null);
    setResetBusy(true);
    try {
      const webOrigin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : null;
      const result = await authClient.requestPasswordReset({
        email: user.email,
        redirectTo: resolvePasswordResetRedirectTo(webOrigin, user.email),
      });
      if (result.error) {
        setPasswordError(result.error.message ?? 'Could not send reset email');
        return;
      }
      setPasswordNote('If this account can receive mail, a reset link is on the way.');
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Could not send reset email'
      );
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <View
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-border bg-card',
        className
      )}
    >
      <AuthSlabCorners />

      <View className="min-h-0 flex-row items-stretch border-b border-border">
        <View className="w-[76px] items-center justify-center border-r border-border bg-background py-5">
          <View className="size-12 items-center justify-center rounded-[3px] border border-border bg-card-panel">
            {verified ? (
              <CircleCheckIcon className="size-6 text-success" weight="bold" />
            ) : (
              <View
                accessibilityLabel="Email not verified"
                className="size-2 rounded-full bg-warning"
              />
            )}
          </View>
        </View>
        <View className="min-w-0 flex-1 justify-center gap-1 px-6 py-4">
          <Text className="font-mono text-[11px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
            Sign-in email
          </Text>
          <Text
            className="text-base font-semibold tracking-tight text-foreground"
            selectable
          >
            {email}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {verified
              ? 'Verified. Password reset and invites use this address.'
              : 'Not verified yet — confirm it before relying on resets.'}
          </Text>
        </View>
      </View>

      <View className="pb-5">
        {mailEnabled ? (
          <CredentialsExpand
            title="Change email"
            open={editor === 'email'}
            onToggle={() => {
              toggleEditor('email');
            }}
          >
            {!emailAwaitingOtp ? (
              <View className="gap-4">
                <Text className="text-sm leading-5 text-muted-foreground">
                  We will send a verification code to the new address. Your sign-in
                  email updates only after that code confirms.
                </Text>
                <View className="gap-2">
                  <Label nativeID={emailId}>New email</Label>
                  <TextInput
                    value={newEmail}
                    onChangeText={(value) => {
                      setNewEmail(value);
                      setEmailError(null);
                    }}
                    disabled={emailBusy}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    accessibilityLabel="New email"
                    accessibilityLabelledBy={emailId}
                    returnKeyType="go"
                    submitBehavior="submit"
                    onSubmitEditing={() => {
                      void requestEmailChange();
                    }}
                  />
                </View>

                {emailError ? (
                  <View className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                    <Text
                      className="text-sm text-destructive"
                      accessibilityLiveRegion="polite"
                      accessibilityRole="alert"
                    >
                      {emailError}
                    </Text>
                  </View>
                ) : null}

                {emailNote ? (
                  <Text
                    className="text-sm text-muted-foreground"
                    accessibilityLiveRegion="polite"
                  >
                    {emailNote}
                  </Text>
                ) : null}

                <Button
                  onPress={() => {
                    void requestEmailChange();
                  }}
                  disabled={emailBusy}
                  busy={emailBusy}
                >
                  <ButtonText>Send verification code</ButtonText>
                </Button>
              </View>
            ) : (
              <View className="gap-4">
                <Text className="text-sm leading-5 text-muted-foreground">
                  Enter the {String(EMAIL_VERIFICATION_OTP_LENGTH)}-digit verification
                  code sent to{' '}
                  <Text className="font-medium text-foreground">
                    {normalizeVerificationEmail(newEmail)}
                  </Text>
                  . This verifies the address and switches your sign-in email.
                </Text>

                <View className="gap-2">
                  <Label nativeID={otpId}>Verification code</Label>
                  <TextInput
                    value={emailOtp}
                    onChangeText={(value) => {
                      setEmailOtp(
                        normalizeVerificationOtp(value).slice(
                          0,
                          EMAIL_VERIFICATION_OTP_LENGTH
                        )
                      );
                      setEmailError(null);
                    }}
                    disabled={emailBusy}
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
                    accessibilityLabel="Email verification code"
                    accessibilityLabelledBy={otpId}
                    className="font-mono tracking-[0.35em]"
                    onSubmitEditing={() => {
                      void confirmEmailChange();
                    }}
                  />
                </View>

                {emailError ? (
                  <View className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                    <Text
                      className="text-sm text-destructive"
                      accessibilityLiveRegion="polite"
                      accessibilityRole="alert"
                    >
                      {emailError}
                    </Text>
                  </View>
                ) : null}

                {emailNote ? (
                  <Text
                    className="text-sm text-muted-foreground"
                    accessibilityLiveRegion="polite"
                  >
                    {emailNote}
                  </Text>
                ) : null}

                <Button
                  onPress={() => {
                    void confirmEmailChange();
                  }}
                  disabled={emailBusy || !isCompleteVerificationOtp(emailOtp)}
                  busy={emailBusy}
                >
                  <ButtonText>Verify and update email</ButtonText>
                </Button>

                <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={emailBusy || emailResendBusy}
                    busy={emailResendBusy}
                    onPress={() => {
                      void resendEmailChange();
                    }}
                  >
                    <ButtonText>Resend code</ButtonText>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={emailBusy || emailResendBusy}
                    onPress={() => {
                      resetEmailForm();
                    }}
                  >
                    <ButtonText>Use a different address</ButtonText>
                  </Button>
                </View>
              </View>
            )}
          </CredentialsExpand>
        ) : null}

        <CredentialsExpand
          title="Change password"
          open={editor === 'password'}
          onToggle={() => {
            toggleEditor('password');
          }}
          divider={mailEnabled}
        >
          <View className="gap-4">
            <View className="gap-2">
              <Label nativeID={currentId}>Current password</Label>
              <TextInput
                value={currentPassword}
                onChangeText={(value) => {
                  setCurrentPassword(value);
                  setPasswordError(null);
                }}
                disabled={passwordBusy}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete={Platform.OS === 'web' ? 'current-password' : 'password'}
                textContentType="password"
                accessibilityLabel="Current password"
                accessibilityLabelledBy={currentId}
              />
            </View>

            <View className="gap-2">
              <Label nativeID={nextId}>New password</Label>
              <TextInput
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  setPasswordError(null);
                }}
                disabled={passwordBusy}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete={Platform.OS === 'web' ? 'new-password' : 'password-new'}
                textContentType="newPassword"
                passwordRules={`minlength: ${String(MIN_PASSWORD_LENGTH)}; required: lower; required: upper; required: digit;`}
                accessibilityLabel="New password"
                accessibilityLabelledBy={nextId}
              />
              <PasswordRequirementsIndicator password={newPassword} />
            </View>

            <View className="gap-2">
              <Label nativeID={confirmId}>Confirm new password</Label>
              <TextInput
                value={confirm}
                onChangeText={(value) => {
                  setConfirm(value);
                  setPasswordError(null);
                }}
                disabled={passwordBusy}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete={Platform.OS === 'web' ? 'new-password' : 'password-new'}
                textContentType="newPassword"
                returnKeyType="go"
                submitBehavior="submit"
                accessibilityLabel="Confirm new password"
                accessibilityLabelledBy={confirmId}
                onSubmitEditing={() => {
                  void changePassword();
                }}
              />
            </View>

            {passwordError ? (
              <View className="rounded-[3px] border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <Text
                  className="text-sm text-destructive"
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                >
                  {passwordError}
                </Text>
              </View>
            ) : null}

            {passwordNote ? (
              <Text
                className="text-sm text-muted-foreground"
                accessibilityLiveRegion="polite"
              >
                {passwordNote}
              </Text>
            ) : null}

            <Button
              onPress={() => {
                void changePassword();
              }}
              disabled={passwordBusy}
              busy={passwordBusy}
            >
              <ButtonText>Update password</ButtonText>
            </Button>

            {mailEnabled ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={passwordBusy || resetBusy}
                busy={resetBusy}
                onPress={() => {
                  void sendResetLink();
                }}
                className="self-start"
              >
                <ButtonText>Email me a reset link</ButtonText>
              </Button>
            ) : null}
          </View>
        </CredentialsExpand>
      </View>
    </View>
  );
}
