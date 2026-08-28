import { useApiKeepAlive } from '@/hooks/useApiKeepAlive';
import { useCollectionLiveSync } from '@/hooks/useCollectionLiveSync';
import { AppBootstrapProvider } from '@/hooks/useAppBootstrap';
import { authClient } from '@/src/lib/auth-client';

function AppBootstrapEffects({ signedIn }: { signedIn: boolean }) {
  useApiKeepAlive(signedIn);
  useCollectionLiveSync(signedIn);
  return null;
}

export function AppBootstrap({ children }: { children?: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const signedInUserId = session?.user?.id ?? null;

  return (
    <AppBootstrapProvider signedInUserId={signedInUserId}>
      <AppBootstrapEffects signedIn={Boolean(signedInUserId)} />
      {children}
    </AppBootstrapProvider>
  );
}
