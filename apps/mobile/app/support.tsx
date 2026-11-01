import { useRouter } from 'expo-router';
import { Linking, View } from 'react-native';
import { LegalPage, type LegalSection } from '@/components/settings/LegalPage';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { RIOT_DISCLAIMER, SUPPORT_EMAIL, supportMailto } from '@/constants/legal';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Forgot your password',
    paragraphs: [
      'On the sign-in screen, choose "Forgot password?" and enter your email. A reset link arrives by email.',
    ],
  },
  {
    heading: 'Delete your account',
    paragraphs: [
      'Settings → Credentials → Delete account. Enter your password to confirm; your account and its data are removed immediately.',
    ],
  },
  {
    heading: 'Report a problem or offensive content',
    paragraphs: [
      `Email ${SUPPORT_EMAIL} with a description and, for a deck, its link. We review reports and remove content that breaks the rules within 24 hours.`,
    ],
  },
  {
    heading: 'Legal',
    paragraphs: [
      RIOT_DISCLAIMER,
      'Card data and prices are provided by Piltover Archive and Cardmarket.',
    ],
  },
];

export default function SupportScreen() {
  const router = useRouter();
  return (
    <LegalPage title="Support" subtitle={SUPPORT_EMAIL} sections={SECTIONS}>
      <View className="gap-3">
        <Text className="text-sm leading-6 text-muted-foreground">
          Questions, bugs or feedback about The Astral Grove: email us and we will get
          back to you.
        </Text>
        <View className="gap-3">
          <Button
            onPress={() => {
              void Linking.openURL(supportMailto('The Astral Grove support'));
            }}
          >
            <ButtonText>Email support</ButtonText>
          </Button>
          <Button variant="outline" onPress={() => router.push('/privacy')}>
            <ButtonText>Privacy policy</ButtonText>
          </Button>
        </View>
      </View>
    </LegalPage>
  );
}
