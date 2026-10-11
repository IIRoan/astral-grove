/** Set identity for search/filters — no image assets (safe for unit tests). */
export const SET_DIRECTORY: ReadonlyArray<{
  code: string;
  name: string;
  released: string;
  special?: boolean;
}> = [
  { code: 'OGN', name: 'Origins', released: 'Oct 2025' },
  { code: 'SFD', name: 'Spiritforged', released: 'Feb 2026' },
  { code: 'UNL', name: 'Unleashed', released: 'May 2026' },
  { code: 'OGS', name: 'Proving Grounds', released: 'Oct 2025', special: true },
  {
    code: 'OGN-NN',
    name: 'Origins | Nexus Night',
    released: 'Oct 2025',
    special: true,
  },
  {
    code: 'SFD-NN',
    name: 'Spiritforged | Nexus Night',
    released: 'Feb 2026',
    special: true,
  },
  {
    code: 'UNL-NN',
    name: 'Unleashed | Nexus Night',
    released: 'May 2026',
    special: true,
  },
  { code: 'ARC', name: 'Arcane Box Set', released: 'Dec 2025', special: true },
  { code: 'WRLD25', name: 'Worlds Bundle 2025', released: 'Oct 2025', special: true },
  { code: 'VEN', name: 'Vendetta', released: 'Jul 2026' },
  {
    code: 'VEN-NN',
    name: 'Vendetta | Nexus Night',
    released: 'Jul 2026',
    special: true,
  },
  { code: 'RAD', name: 'Radiance', released: 'Oct 2026' },
];
