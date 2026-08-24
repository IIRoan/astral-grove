import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import {
  buildCollectionInviteDeepLink,
  collectionInviteAcceptPath,
  isLikelyMobileUserAgent,
} from '@/lib/collection-invite-link';

function readBrowserUserAgent(): string {
  if (Platform.OS !== 'web') return '';
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent ?? '';
}

function acceptHref(token: string): Href {
  return collectionInviteAcceptPath(token) as Href;
}

/** HTTPS invite landing: desktop→web accept, mobile web→deep link then fallback, native→in-app accept. */
export default function CollectionInviteLinkingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : undefined;
  const [attemptedAppOpen, setAttemptedAppOpen] = useState(false);

  const deepLink = token ? buildCollectionInviteDeepLink(token) : null;
  const acceptPath = token ? acceptHref(token) : null;
  const onNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const onWeb = Platform.OS === 'web';
  const mobileBrowser = onWeb && isLikelyMobileUserAgent(readBrowserUserAgent());

  useEffect(() => {
    if (!token || !deepLink || !acceptPath) return;

    if (onNative) {
      router.replace(acceptPath);
      return;
    }

    if (onWeb && !mobileBrowser) {
      router.replace(acceptPath);
      return;
    }

    if (onWeb && mobileBrowser) {
      // Attempt to hand off to the installed app; keep this page as fallback UI.
      window.location.href = deepLink;
      setAttemptedAppOpen(true);
    }
  }, [token, deepLink, acceptPath, onNative, onWeb, mobileBrowser, router]);

  if (!token || !deepLink || !acceptPath) {
    return (
      <ScreenLayout>
        <ScreenHeader title="Join collection" />
        <Text className="mt-4 text-sm text-muted-foreground">
          Missing invite token.
        </Text>
      </ScreenLayout>
    );
  }

  if (onNative || (onWeb && !mobileBrowser)) {
    return <Redirect href={acceptPath} />;
  }

  return (
    <ScreenLayout>
      <ScreenHeader title="Open The Astral Grove" />
      <View className="mt-4 gap-4">
        <Text className="text-base text-foreground">
          {attemptedAppOpen
            ? 'Opening The Astral Grove…'
            : 'This invite opens in The Astral Grove.'}
        </Text>
        <Text className="text-sm text-muted-foreground">
          If the app does not open, use one of the options below.
        </Text>
        <Button
          onPress={() => {
            void Linking.openURL(deepLink);
          }}
        >
          <ButtonText>Open in The Astral Grove</ButtonText>
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            router.replace(acceptPath);
          }}
        >
          <ButtonText>Continue in browser</ButtonText>
        </Button>
      </View>
    </ScreenLayout>
  );
}
