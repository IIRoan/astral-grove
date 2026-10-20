import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { collectionInviteAcceptPath } from '@/lib/collection-invite-link';
import { FORM_COLUMN_CLASS } from '@/lib/responsive-layout';

export default function CollectionInviteLinkingScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : undefined;
  if (!token) {
    return (
      <ScreenLayout contentClassName={FORM_COLUMN_CLASS}>
        <ScreenHeader title="Join collection" />
        <Text className="mt-4 text-sm text-muted-foreground">
          Missing invite token.
        </Text>
      </ScreenLayout>
    );
  }
  return <Redirect href={collectionInviteAcceptPath(token) as Href} />;
}
