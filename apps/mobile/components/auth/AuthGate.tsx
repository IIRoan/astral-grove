import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPanel } from '@/components/auth/AuthPanel';
import { AuthPlaymat } from '@/components/auth/AuthPlaymat';
import { useAuthWideLayout } from '@/components/auth/useAuthWideLayout';
import type { Mode } from '@/components/auth/auth-types';
import { AppLoadingScreen } from '@/components/ui/app-loader';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useEmailVerificationRequired } from '@/hooks/useEmailVerificationRequired';
import { normalizeVerificationEmail } from '@/lib/email-verification';
import { authClient } from '@/src/lib/auth-client';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const wide = useAuthWideLayout();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<
    string | null
  >(null);
  const [sessionReady, setSessionReady] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const { isUserReady } = useAppBootstrap();
  const verificationQuery = useEmailVerificationRequired();
  const verificationRequired = verificationQuery.data === true;

  useEffect(() => {
    if (!isPending) {
      setSessionReady(true);
    }
  }, [isPending]);

  const unverifiedSession =
    verificationRequired &&
    Boolean(session?.user) &&
    session?.user?.emailVerified === false;

  // Hold unverified sessions on the playmat once mail is configured.
  useEffect(() => {
    if (!unverifiedSession || !session?.user?.email) return;
    setPendingVerificationEmail(normalizeVerificationEmail(session.user.email));
  }, [unverifiedSession, session?.user?.email]);

  // Drop the verify gate only after the account is confirmed.
  useEffect(() => {
    if (session?.user?.emailVerified === true && pendingVerificationEmail) {
      setPendingVerificationEmail(null);
    }
  }, [session?.user?.emailVerified, pendingVerificationEmail]);

  // First session resolve only — later refetches must not remount the login UI.
  if (!sessionReady || verificationQuery.isPending) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <AppLoadingScreen size="lg" className="bg-transparent" />
      </View>
    );
  }

  const holdForVerification = Boolean(pendingVerificationEmail) || unverifiedSession;

  if (!session?.user || holdForVerification) {
    return (
      <AuthPlaymat mode={mode}>
        <AuthPanel
          variant="screen"
          screenLayout={wide ? 'wide' : 'mobile'}
          mode={mode}
          onModeChange={setMode}
          pendingVerificationEmail={pendingVerificationEmail}
          onPendingVerificationEmailChange={setPendingVerificationEmail}
        />
      </AuthPlaymat>
    );
  }

  if (!isUserReady) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <AppLoadingScreen size="lg" className="bg-transparent" />
      </View>
    );
  }

  return <>{children}</>;
}
