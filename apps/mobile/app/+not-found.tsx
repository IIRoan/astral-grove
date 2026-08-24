import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Button, ButtonText } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Heading } from '@/components/ui/heading';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-background p-5">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyTitle>
              <Heading level="4">This screen doesn&apos;t exist.</Heading>
            </EmptyTitle>
            <EmptyDescription>
              Head back to the home screen to continue.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Link href="/" asChild>
          <Button variant="link" className="mt-4">
            <ButtonText>Go to home screen</ButtonText>
          </Button>
        </Link>
      </View>
    </>
  );
}
