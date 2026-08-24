import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AuthSlabCorners } from '@/components/auth/AuthArtifacts';
import { EmailVerificationForm } from '@/components/auth/EmailVerificationForm';
import { CircleCheckIcon } from '@/components/icons';
import { Text } from '@/components/ui/text';
import { useEmailVerificationRequired } from '@/hooks/useEmailVerificationRequired';
import { normalizeVerificationEmail } from '@/lib/email-verification';
import { cn } from '@/lib/utils';
import { invalidateUserDataQueries } from '@/src/api/queryClient';
import { authClient } from '@/src/lib/auth-client';

type EmailVerificationSectionProps = {
  className?: string;
};

export function EmailVerificationSection({ className }: EmailVerificationSectionProps) {
  const queryClient = useQueryClient();
  const sessionQuery = authClient.useSession();
  const user = sessionQuery.data?.user;
  const verificationQuery = useEmailVerificationRequired();
  const verificationRequired = verificationQuery.data === true;

  if (!user || !verificationRequired) {
    return null;
  }

  const email = normalizeVerificationEmail(user.email);
  const verified = user.emailVerified === true;

  if (verified) {
    return (
      <View
        className={cn(
          'relative overflow-hidden rounded-[10px] border border-border bg-card',
          className
        )}
      >
        <AuthSlabCorners />
        <View className="min-h-0 flex-1 flex-row items-stretch">
          <View className="w-[76px] items-center justify-center border-r border-border bg-background py-6">
            <View className="size-12 items-center justify-center rounded-[3px] border border-border bg-card-panel">
              <CircleCheckIcon className="size-6 text-success" weight="bold" />
            </View>
          </View>
          <View className="min-w-0 flex-1 justify-center gap-1 px-4 py-4">
            <Text className="text-lg font-semibold tracking-tight text-foreground">
              Email verified
            </Text>
            <Text
              className="font-mono text-[12px] text-muted-foreground"
              numberOfLines={1}
            >
              {email}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Sign-in and password reset use this address.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-border bg-card px-4 py-4',
        className
      )}
    >
      <AuthSlabCorners />
      <View className="mb-4 flex-row items-center gap-2">
        <View
          accessibilityLabel="Verification required"
          className="size-1.5 rounded-full bg-warning"
        />
        <Text className="font-mono text-[11px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
          Action required
        </Text>
      </View>
      <EmailVerificationForm
        email={email}
        compact
        autoSendOnMount
        submitLabel="Verify email"
        onVerified={async () => {
          await sessionQuery.refetch();
          await invalidateUserDataQueries(queryClient);
        }}
      />
    </View>
  );
}
