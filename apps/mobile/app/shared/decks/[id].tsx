import Head from 'expo-router/head';
import DeckEditorScreen from '@/app/(tabs)/decks/[id]';

export default function SharedDeckScreen() {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <DeckEditorScreen />
    </>
  );
}
