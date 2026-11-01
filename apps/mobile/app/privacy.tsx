import { LegalPage, type LegalSection } from '@/components/settings/LegalPage';
import { SUPPORT_EMAIL } from '@/constants/legal';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      `The Astral Grove is an independent companion app for the Riftbound trading card game. Questions about this policy or your data: ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    heading: 'What we collect',
    paragraphs: [
      'Account: your email address, display name, whether your email is verified, and your password, which we store only as a salted hash.',
      'Your content: your collection, wishlist and decks, deck links you choose to share, collection sharing invites and membership, a history of changes to your collection, and the app settings you sync.',
      'Sign-in sessions: a session token plus the IP address and device user agent seen at sign-in, so you stay signed in and we can protect your account.',
      'Crash reports: when the app hits an error, a report with technical details (device model, operating system, app version and the error itself) goes to our self-hosted error tracker. It does not include your name or email.',
      'You can browse cards without an account. Those requests reach our servers like any web request, and the IP address appears in short-lived server logs.',
    ],
  },
  {
    heading: 'Camera',
    paragraphs: [
      'The card scanner uses the camera to read the collector number printed on your cards. Camera images are processed on your device and never uploaded.',
    ],
  },
  {
    heading: 'What we do not do',
    paragraphs: [
      'No advertising, no tracking across other apps or websites, no third-party analytics, and we never sell your data.',
    ],
  },
  {
    heading: 'How we use your data',
    paragraphs: [
      'To run the service: sign-in, syncing your collection and decks across devices, sharing, and account emails (verification codes, password resets and collection invites). To keep the service secure and to fix bugs.',
    ],
  },
  {
    heading: 'Who else sees it',
    paragraphs: [
      'Our servers and database run with a cloud hosting provider, and account emails go out through our own mail server. App updates are delivered by Expo, which sees your IP address and device details when the app checks for an update.',
      'Card data and prices come from Piltover Archive and Cardmarket. We do not send them your personal data.',
      'If you share your collection, the other member sees your name and email. Anyone with a deck link you shared can view that deck until you turn the link off.',
    ],
  },
  {
    heading: 'Keeping and deleting your data',
    paragraphs: [
      'We keep your data for as long as you have an account. You can delete your account in the app under Settings → Credentials → Delete account. That immediately removes your account, sessions, collection, wishlist, decks and shared deck links from our database. A collection you shared stays with its other member. Crash reports, server logs and backups expire on their own schedule.',
      `You can also ask us to access, correct, export or delete your data by emailing ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'The Astral Grove is not directed at children under 13, and we do not knowingly collect their data.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'We will update this page when our practices change and adjust the date above.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy policy"
      subtitle="Last updated 1 November 2026"
      sections={SECTIONS}
    />
  );
}
