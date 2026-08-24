/** Real card description fixtures sourced from the local API cache. */
export const CARD_RULE_FIXTURES = {
  ahriNineTailedFox: {
    variantNumber: 'OGN-255',
    description:
      'When an enemy unit attacks a battlefield you control, give it -1 [Might] this turn, to a minimum of 1 [Might].',
  },
  sunlitGuardian: {
    variantNumber: 'OGN-054',
    description:
      "[Shield] (+1 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)",
  },
  jinxDemolitionist: {
    variantNumber: 'OGN-030a',
    description:
      "[ACCELERATE] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\n[ASSAULT 2] (+2 [Might] while I'm an attacker.)\nWhen you play me, discard 2.",
  },
  bladeOfTheRuinedKing: {
    variantNumber: 'SFD-178',
    description:
      '[Equip] — [Order], Kill a friendly unit (Pay the cost: Attach this to a unit you control.)',
  },
  cleave: {
    variantNumber: 'OGN-005',
    description:
      "[ACTION] (Play on your turn or in showdowns.)\n\nGive a unit [ASSAULT 3] this turn. (+3 [Might] while it's an attacker.)",
  },
  azirEmperor: {
    variantNumber: 'SFD-197',
    description:
      "Your Sand Soldiers have [Weaponmaster].\n[1], [Tap]: Play a 2 [Might] Sand Soldier unit token to your base. Use only if you've played an Equipment this turn.",
  },
} as const;
