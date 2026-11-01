import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { toast } from '@/components/ui/toast.api';
import { authClient } from '@/src/lib/auth-client';

/** Returns a guard for account-only actions: true when signed in, otherwise sends guests to sign in. */
export function useRequireAccount(): () => boolean {
  const router = useRouter();
  const signedIn = Boolean(authClient.useSession().data?.user);
  return useCallback(() => {
    if (signedIn) return true;
    toast('Sign in or create an account to track your cards');
    router.dismissTo('/settings');
    return false;
  }, [router, signedIn]);
}
