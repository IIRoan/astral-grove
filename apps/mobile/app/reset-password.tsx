import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthPlaymat } from '@/components/auth/AuthPlaymat';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { parsePasswordResetSearchParams } from '@/lib/password-reset';

function ResetPasswordMessage({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View className="gap-5">
      <View className="gap-2">
        <Text className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </Text>
        <Text className="text-sm leading-5 text-muted-foreground">{body}</Text>
      </View>
      <Button size="lg" onPress={onAction}>
        <ButtonText>{actionLabel}</ButtonText>
      </Button>
    </View>
  );
}

/** Reset links stay on the HTTPS page until password-based sign-in. */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    token?: string;
    email?: string;
    error?: string;
  }>();
  const parsed = parsePasswordResetSearchParams(params);
  const [finished, setFinished] = useState(false);
  const token = parsed && 'token' in parsed ? parsed.token : null;

  const goHome = () => {
    router.replace('/' as Href);
  };

  let body: React.ReactNode;

  if (finished) {
    body = (
      <ResetPasswordMessage
        title="Password updated"
        body="Sign in with your new password to continue."
        actionLabel="Back to sign in"
        onAction={goHome}
      />
    );
  } else if (parsed && 'error' in parsed) {
    body = (
      <ResetPasswordMessage
        title="Link expired"
        body="This reset link is invalid or expired. Request a new one from sign-in."
        actionLabel="Back to sign in"
        onAction={goHome}
      />
    );
  } else if (!token) {
    body = (
      <ResetPasswordMessage
        title="Missing reset link"
        body="This reset link is missing or invalid. Request a new one from sign-in."
        actionLabel="Back to sign in"
        onAction={goHome}
      />
    );
  } else {
    body = (
      <ResetPasswordForm
        token={token}
        onBackToSignIn={goHome}
        onSuccess={() => setFinished(true)}
      />
    );
  }

  return <AuthPlaymat mode="sign-in">{body}</AuthPlaymat>;
}
