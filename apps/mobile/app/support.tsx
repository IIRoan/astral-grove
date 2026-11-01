import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { LegalPage, type LegalSection } from '@/components/settings/LegalPage';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { emailSupport, RIOT_DISCLAIMER, SUPPORT_EMAIL } from '@/constants/legal';

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
      `Use Report on any community or shared deck, or email ${SUPPORT_EMAIL} with a description and the deck's link. Block author hides that author's decks. We review reports and remove content that breaks the terms of use within 24 hours.`,
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
          <Button onPress={() => emailSupport('The Astral Grove support')}>
            <ButtonText>Email support</ButtonText>
          </Button>
          <Button variant="outline" onPress={() => router.push('/privacy')}>
            <ButtonText>Privacy policy</ButtonText>
          </Button>
          <Button variant="outline" onPress={() => router.push('/terms')}>
            <ButtonText>Terms of use</ButtonText>
          </Button>
        </View>
      </View>
    </LegalPage>
  );
}
