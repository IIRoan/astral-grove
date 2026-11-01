import { LegalPage, type LegalSection } from '@/components/settings/LegalPage';
import { RIOT_DISCLAIMER, SUPPORT_EMAIL } from '@/constants/legal';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Using The Astral Grove',
    paragraphs: [
      'The Astral Grove is a free, unofficial companion app for the Riftbound trading card game. You must be at least 13 years old to create an account. These terms apply alongside Apple’s Standard End User License Agreement.',
    ],
  },
  {
    heading: 'Zero tolerance for objectionable content',
    paragraphs: [
      'There is no tolerance for objectionable content or abusive users. Do not create or share deck names, descriptions or anything else that is hateful, harassing, threatening, sexually explicit, violent, illegal or that infringes someone else’s rights.',
      'Objectionable words in community and shared decks are filtered automatically. You can report any deck with the Report link and block an author so their decks are hidden. We review reports within 24 hours, remove content that breaks these terms, and suspend or delete the accounts responsible.',
    ],
  },
  {
    heading: 'Community decks',
    paragraphs: [
      'Community decks come from Piltover Archive and are written by other players. We do not create or endorse them.',
    ],
  },
  {
    heading: 'Your account',
    paragraphs: [
      'Keep your password private. You can delete your account and its data at any time under Settings → Credentials → Delete account. We may suspend or delete accounts that break these terms.',
    ],
  },
  {
    heading: 'Card data and prices',
    paragraphs: [
      'Card data and prices come from Piltover Archive and Cardmarket and are provided as-is for reference only. They may be incomplete or out of date.',
    ],
  },
  {
    heading: 'Riot Games',
    paragraphs: [RIOT_DISCLAIMER],
  },
  {
    heading: 'Contact',
    paragraphs: [`Questions about these terms: ${SUPPORT_EMAIL}.`],
  },
];

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms of use"
      subtitle="Last updated 1 November 2026"
      sections={SECTIONS}
    />
  );
}
