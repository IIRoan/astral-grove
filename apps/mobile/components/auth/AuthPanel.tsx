import { LogOutIcon } from '@/components/icons';
import { useEffect, useId, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  type TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import type {
  AuthPanelVariant,
  AuthScreenLayout,
  Mode,
} from '@/components/auth/auth-types';
import { AuthSlabCorners } from '@/components/auth/AuthArtifacts';
import { EmailVerificationForm } from '@/components/auth/EmailVerificationForm';
import { PasswordRequirementsIndicator } from '@/components/auth/PasswordRequirementsIndicator';
import {
  MIN_PASSWORD_LENGTH,
  signUpPasswordIssues,
} from '@/components/auth/password-requirements';
import { Button, ButtonText } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/ui/text-input';
import { UserBlobatar } from '@/components/ui/user-blobatar';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useEmailVerificationRequired } from '@/hooks/useEmailVerificationRequired';
import { useValueChangeFlag } from '@/hooks/useValueChangeFlag';
import { normalizeVerificationEmail } from '@/lib/email-verification';
import { resolvePasswordResetRedirectTo } from '@/lib/password-reset';
import { cn } from '@/lib/utils';
import { clearPersistedCatalogIndex } from '@/services/catalogIndexService';
import { clearPersistedCollection } from '@/services/collectionCacheService';
import { clearPersistedOwnedDecks } from '@/services/deckCacheService';
import { clearPersistedWishlist } from '@/services/wishlistCacheService';
import { clearLastCachedUserId } from '@/services/userCacheScope';
import { migrateLocalCollectionToRemote } from '@/services/collectionService';
import {
  invalidateUserDataQueries,
  removeUserDataQueries,
} from '@/src/api/queryClient';
import { clearPersistedQueryClient } from '@/src/api/queryPersist';
import { authClient } from '@/src/lib/auth-client';

const MODE_TRANSITION_MS = 280;
const MODE_OPTIONS = [
  { id: 'sign-in' as const, label: 'Sign in' },
  { id: 'sign-up' as const, label: 'Sign up' },
] as const;

type AuthPanelProps = {
  variant?: AuthPanelVariant;
  screenLayout?: AuthScreenLayout;
  mode?: Mode;
  onModeChange?: (mode: Mode) => void;
  pendingVerificationEmail?: string | null;
  onPendingVerificationEmailChange?: (email: string | null) => void;
  className?: string;
};

function ModeSwitch({
  mode,
  onModeChange,
  disabled,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const [layouts, setLayouts] = useState<
    Partial<Record<Mode, { x: number; width: number }>>
  >({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const hasMeasured = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[mode];
    if (!layout) return;
    const duration = reduceMotion ? 0 : MODE_TRANSITION_MS;
    const easing = Easing.out(Easing.cubic);
    if (hasMeasured.value === 0) {
      indicatorX.value = layout.x;
      indicatorWidth.value = layout.width;
      hasMeasured.value = 1;
      return;
    }
    indicatorX.value = withTiming(layout.x, { duration, easing });
    indicatorWidth.value = withTiming(layout.width, { duration, easing });
  }, [hasMeasured, indicatorWidth, indicatorX, layouts, mode, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: hasMeasured.value,
    width: indicatorWidth.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View accessibilityRole="tablist" className="relative border-b border-border">
      <View className="flex-row gap-6">
        {MODE_OPTIONS.map((option) => {
          const selected = mode === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              disabled={disabled}
              className="min-h-11 justify-center pb-3 active:opacity-70"
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setLayouts((current) => {
                  const previous = current[option.id];
                  if (previous?.x === x && previous.width === width) return current;
                  return { ...current, [option.id]: { x, width } };
                });
              }}
              onPress={() => {
                onModeChange(option.id);
              }}
            >
              <Text
                className={cn(
                  'text-[15px] font-semibold tracking-tight',
                  selected ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Animated.View
        pointerEvents="none"
        className="absolute bottom-0 left-0 h-0.5 bg-foreground"
        style={indicatorStyle}
      />
    </View>
  );
}

/** Keep React state in sync when password managers fill without a reliable onChangeText. */
function syncFieldText(
  onChangeText: (value: string) => void
): NonNullable<RNTextInputProps['onEndEditing']> {
  return (event) => {
    onChangeText(event.nativeEvent.text);
  };
}

function webFieldProps(name: string, id: string): Record<string, string> | null {
  if (Platform.OS !== 'web') return null;
  return { name, id };
}

type AuthFieldProps = {
  onChangeText: (value: string) => void;
  onSubmitEditing?: RNTextInputProps['onSubmitEditing'];
  inputRef?: React.RefObject<RNTextInput | null>;
  disabled?: boolean;
};

function AuthEmailField({
  value,
  onChangeText,
  onSubmitEditing,
  inputRef,
  disabled,
  nextFieldRef,
}: AuthFieldProps & {
  value: string;
  nextFieldRef?: React.RefObject<RNTextInput | null>;
}) {
  const labelId = useId();

  return (
    <View className="gap-2">
      <Label nativeID={labelId}>Email</Label>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={syncFieldText(onChangeText)}
        disabled={disabled}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="username"
        textContentType="username"
        keyboardType="email-address"
        inputMode="email"
        importantForAutofill="yes"
        returnKeyType="next"
        submitBehavior="submit"
        enablesReturnKeyAutomatically
        placeholder="you@example.com"
        accessibilityLabel="Email"
        accessibilityLabelledBy={labelId}
        {...webFieldProps('username', 'auth-username')}
        onSubmitEditing={(event) => {
          onChangeText(event.nativeEvent.text);
          if (nextFieldRef?.current) {
            nextFieldRef.current.focus();
            return;
          }
          onSubmitEditing?.(event);
        }}
      />
    </View>
  );
}

function AuthPasswordField({
  mode,
  value,
  onChangeText,
  onSubmitEditing,
  inputRef,
  disabled,
}: AuthFieldProps & { mode: Mode; value: string }) {
  const labelId = useId();
  const isSignUp = mode === 'sign-up';

  return (
    <View className="gap-2">
      <Label nativeID={labelId}>Password</Label>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={syncFieldText(onChangeText)}
        disabled={disabled}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete={
          isSignUp
            ? 'new-password'
            : Platform.OS === 'web'
              ? 'current-password'
              : 'password'
        }
        textContentType={isSignUp ? 'newPassword' : 'password'}
        passwordRules={
          isSignUp
            ? `minlength: ${String(MIN_PASSWORD_LENGTH)}; required: lower; required: upper; required: digit;`
            : undefined
        }
        importantForAutofill="yes"
        returnKeyType="go"
        submitBehavior="submit"
        enablesReturnKeyAutomatically
        placeholder={
          isSignUp ? `At least ${String(MIN_PASSWORD_LENGTH)} characters` : 'Password'
        }
        accessibilityLabel="Password"
        accessibilityLabelledBy={labelId}
        {...webFieldProps(
          isSignUp ? 'new-password' : 'password',
          isSignUp ? 'auth-new-password' : 'auth-password'
        )}
        onSubmitEditing={(event) => {
          onChangeText(event.nativeEvent.text);
          onSubmitEditing?.(event);
        }}
      />
      {isSignUp ? <PasswordRequirementsIndicator password={value} /> : null}
    </View>
  );
}

function readNativeInputValue(
  ref: React.RefObject<RNTextInput | null>,
  fallback: string
): string {
  if (Platform.OS === 'web') {
    const node = ref.current as unknown as { value?: string } | null;
    if (typeof node?.value === 'string' && node.value.length > 0) {
      return node.value;
    }
  }
  return fallback;
}

export function AuthPanel({
  variant = 'inline',
  screenLayout = 'mobile',
  mode: controlledMode,
  onModeChange,
  pendingVerificationEmail: controlledPendingEmail,
  onPendingVerificationEmailChange,
  className,
}: AuthPanelProps) {
  const queryClient = useQueryClient();
  const sessionQuery = authClient.useSession();
  const { data: session, isPending, isRefetching } = sessionQuery;
  const verificationRequired = useEmailVerificationRequired().data === true;
  const [internalMode, setInternalMode] = useState<Mode>('sign-in');
  const mode = controlledMode ?? internalMode;
  const isScreen = variant === 'screen';
  const isWideScreen = isScreen && screenLayout === 'wide';

  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Better Auth already sent OTP on sign-up/sign-in — skip sendOnMount (would invalidate it).
  const [otpSentWithAuth, setOtpSentWithAuth] = useState(false);
  const [internalPendingEmail, setInternalPendingEmail] = useState<string | null>(null);
  const pendingVerificationEmail =
    controlledPendingEmail !== undefined
      ? controlledPendingEmail
      : internalPendingEmail;

  const setPendingVerificationEmail = (next: string | null) => {
    if (controlledPendingEmail === undefined) {
      setInternalPendingEmail(next);
    }
    onPendingVerificationEmailChange?.(next);
  };

  const verificationEmail =
    pendingVerificationEmail ??
    (verificationRequired &&
    session?.user?.emailVerified === false &&
    session.user.email
      ? normalizeVerificationEmail(session.user.email)
      : null);

  // Clear credentials on mode change (incl. controlledMode); keep in-progress email verification.
  const modeChanged = useValueChangeFlag(mode);
  if (modeChanged && !verificationEmail) {
    setError(null);
    setEmail('');
    setPassword('');
    setForgotPassword(false);
    setResetSent(false);
  }

  const setMode = (next: Mode) => {
    if (controlledMode === undefined) {
      setInternalMode(next);
    }
    onModeChange?.(next);
  };

  const finishAuthenticated = async () => {
    setOtpSentWithAuth(false);
    setPendingVerificationEmail(null);
    await sessionQuery.refetch();
    await migrateLocalCollectionToRemote();
    await invalidateUserDataQueries(queryClient);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    const emailValue = readNativeInputValue(emailRef, email).trim();
    const passwordValue = readNativeInputValue(passwordRef, password);
    setEmail(emailValue);
    setPassword(passwordValue);
    if (emailValue.length === 0 || passwordValue.length === 0) {
      setError('Enter email and password');
      return;
    }
    if (mode === 'sign-up') {
      const issues = signUpPasswordIssues(passwordValue);
      if (issues.length > 0) {
        setError(`Password needs: ${issues.join(', ').toLowerCase()}`);
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'sign-up') {
        const localName = emailValue.split('@')[0]?.trim();
        const result = await authClient.signUp.email({
          email: emailValue,
          password: passwordValue,
          name: localName || 'Collector',
        });
        if (result.error) {
          setError(result.error.message ?? 'Sign up failed');
          return;
        }
        // token=null when requireEmailVerification is on — stay on the playmat for OTP.
        if (!result.data?.token) {
          setOtpSentWithAuth(true);
          setPendingVerificationEmail(normalizeVerificationEmail(emailValue));
          setPassword('');
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email: emailValue,
          password: passwordValue,
        });
        if (result.error) {
          const message = result.error.message ?? 'Sign in failed';
          const needsVerification =
            result.error.status === 403 ||
            /email.*verif|verif.*email|not verified/i.test(message);
          if (needsVerification) {
            setOtpSentWithAuth(true);
            setPendingVerificationEmail(normalizeVerificationEmail(emailValue));
            setPassword('');
            setError(null);
            return;
          }
          setError(message);
          return;
        }
        if (result.data?.user?.emailVerified === false) {
          setOtpSentWithAuth(true);
          setPendingVerificationEmail(normalizeVerificationEmail(emailValue));
          setPassword('');
          return;
        }
      }
      await finishAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    Keyboard.dismiss();
    setError(null);
    const emailValue = readNativeInputValue(emailRef, email).trim();
    setEmail(emailValue);
    if (emailValue.length === 0) {
      setError('Enter your email');
      return;
    }
    setBusy(true);
    try {
      const webOrigin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : null;
      const result = await authClient.requestPasswordReset({
        email: emailValue,
        redirectTo: resolvePasswordResetRedirectTo(webOrigin, emailValue),
      });
      if (result.error) {
        setError(result.error.message ?? 'Could not send reset email');
        return;
      }
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await authClient.signOut();
      await sessionQuery.refetch();
      await clearPersistedCollection();
      await clearPersistedOwnedDecks();
      await clearPersistedWishlist();
      await clearPersistedCatalogIndex();
      await clearPersistedQueryClient();
      await clearLastCachedUserId();
      removeUserDataQueries(queryClient);
    } finally {
      setBusy(false);
    }
  };

  // Skip loader during background session refetches so the form stays mounted.
  if (isPending && !isRefetching) {
    return isScreen ? (
      <View className={cn('gap-2 px-1 py-2', className)}>
        <Text className="text-muted-foreground">Loading account…</Text>
      </View>
    ) : (
      <View
        className={cn(
          'rounded-[10px] border border-border bg-card px-4 py-5',
          className
        )}
      >
        <Text className="text-muted-foreground">Loading account…</Text>
      </View>
    );
  }

  if (session?.user && !verificationEmail) {
    return isScreen ? null : (
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
              userId={session.user.id}
              title={session.user.name || session.user.email}
              size={48}
              framed
            />
          </View>
          <View className="min-w-0 flex-1 justify-between gap-4 px-4 py-4">
            <View className="gap-1">
              <Text
                className="text-lg font-semibold tracking-tight text-foreground"
                numberOfLines={1}
              >
                {session.user.name}
              </Text>
              <Text
                className="font-mono text-[12px] text-muted-foreground"
                numberOfLines={1}
              >
                {session.user.email}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              disabled={busy}
              onPress={() => {
                void handleSignOut();
              }}
              className="self-start flex-row items-center gap-1.5 rounded-[3px] border border-border bg-card-panel px-3 py-2 active:opacity-80"
            >
              <LogOutIcon className="size-3.5 text-foreground" weight="bold" />
              <Text className="text-sm font-normal text-foreground">Sign out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const formBody = verificationEmail ? (
    <EmailVerificationForm
      email={verificationEmail}
      // Restore/AuthGate: request OTP; fresh sign-up/sign-in already sent by Better Auth.
      autoSendOnMount={!otpSentWithAuth}
      onVerified={finishAuthenticated}
      onChangeEmail={() => {
        setOtpSentWithAuth(false);
        setPendingVerificationEmail(null);
        setError(null);
        setPassword('');
        void authClient.signOut().then(() => sessionQuery.refetch());
      }}
    />
  ) : forgotPassword ? (
    <View className={cn('gap-5', isWideScreen && 'gap-6')}>
      <View className="gap-2">
        <Text className="text-xl font-semibold tracking-tight text-foreground">
          Reset password
        </Text>
        <Text className="text-sm leading-5 text-muted-foreground">
          {resetSent
            ? 'If that email is on an account, a reset link is on the way.'
            : 'We will email a link to choose a new password.'}
        </Text>
      </View>

      {!resetSent ? (
        <AuthEmailField
          value={email}
          onChangeText={setEmail}
          inputRef={emailRef}
          disabled={busy}
          onSubmitEditing={() => {
            void handleForgotPassword();
          }}
        />
      ) : null}

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

      {!resetSent ? (
        <Button
          onPress={() => {
            void handleForgotPassword();
          }}
          disabled={busy}
          busy={busy}
          size="lg"
        >
          <ButtonText>Send reset link</ButtonText>
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onPress={() => {
          setForgotPassword(false);
          setResetSent(false);
          setError(null);
        }}
        className="self-start"
      >
        <ButtonText>Back to sign in</ButtonText>
      </Button>
    </View>
  ) : (
    <View
      className={cn('gap-5', isWideScreen && 'gap-6')}
      {...(Platform.OS === 'web' ? ({ role: 'form' } as Record<string, string>) : null)}
    >
      <ModeSwitch mode={mode} onModeChange={setMode} disabled={busy} />

      <View key={mode} className="gap-4">
        <AuthEmailField
          value={email}
          onChangeText={setEmail}
          inputRef={emailRef}
          nextFieldRef={passwordRef}
          disabled={busy}
        />

        <AuthPasswordField
          mode={mode}
          value={password}
          onChangeText={setPassword}
          inputRef={passwordRef}
          disabled={busy}
          onSubmitEditing={() => {
            void handleSubmit();
          }}
        />

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
            void handleSubmit();
          }}
          disabled={busy}
          busy={busy}
          size="lg"
        >
          <ButtonText>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</ButtonText>
        </Button>

        {mode === 'sign-in' && verificationRequired ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={() => {
              setForgotPassword(true);
              setResetSent(false);
              setError(null);
              setPassword('');
            }}
            className="self-start"
          >
            <ButtonText>Forgot password?</ButtonText>
          </Button>
        ) : null}
      </View>
    </View>
  );

  if (isScreen) {
    return <View className={cn('w-full', className)}>{formBody}</View>;
  }

  return (
    <View
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-border bg-card px-4 py-4',
        className
      )}
    >
      <AuthSlabCorners />
      {formBody}
    </View>
  );
}
