import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Button, ButtonText } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { FORM_COLUMN_CLASS } from '@/lib/responsive-layout';

export type LegalSection = { heading: string; paragraphs: string[] };

export function LegalPage({
  title,
  subtitle,
  sections,
  children,
}: {
  title: string;
  subtitle: string;
  sections: LegalSection[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <ScreenLayout contentClassName={FORM_COLUMN_CLASS}>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 w-auto self-start"
        accessibilityLabel="Go back"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      >
        <ButtonText>← Back</ButtonText>
      </Button>
      <ScreenHeader title={title} subtitle={subtitle} />
      <View className="mt-6 gap-6">
        {children}
        {sections.map((section) => (
          <View key={section.heading} className="gap-2">
            <Text
              accessibilityRole="header"
              className="text-base font-semibold text-foreground"
            >
              {section.heading}
            </Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} className="text-sm leading-6 text-muted-foreground">
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScreenLayout>
  );
}
