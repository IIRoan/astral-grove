import type { ImageSourcePropType } from 'react-native';

export type SetCatalogEntry = {
  code: string;
  name: string;
  released: string;
  art: ImageSourcePropType;
  logo?: ImageSourcePropType;
};

/** Optional local set art/labels; dashboard set list comes from `/api/v1/filters` (PA sync). */
export const SET_CATALOG: SetCatalogEntry[] = [
  {
    code: 'OGN',
    name: 'Origins',
    released: 'Oct 2025',
    art: require('@/assets/sets/origins.png'),
    logo: require('@/assets/set-logos/OGN.webp'),
  },
  {
    code: 'SFD',
    name: 'Spiritforged',
    released: 'Feb 2026',
    art: require('@/assets/sets/spiritforged.jpg'),
    logo: require('@/assets/set-logos/SFD.webp'),
  },
  {
    code: 'UNL',
    name: 'Unleashed',
    released: 'May 2026',
    art: require('@/assets/sets/unleashed.jpg'),
    logo: require('@/assets/set-logos/UNL.webp'),
  },
  {
    code: 'OGS',
    name: 'Proving Grounds',
    released: 'Oct 2025',
    art: require('@/assets/sets/proving-grounds.jpg'),
    logo: require('@/assets/set-logos/OGS.webp'),
  },
  {
    code: 'OGN-NN',
    name: 'Origins | Nexus Night',
    released: 'Oct 2025',
    art: require('@/assets/sets/origins.png'),
    logo: require('@/assets/set-logos/OGN-NN.webp'),
  },
  {
    code: 'SFD-NN',
    name: 'Spiritforged | Nexus Night',
    released: 'Feb 2026',
    art: require('@/assets/sets/spiritforged.jpg'),
    logo: require('@/assets/set-logos/SFD-NN.webp'),
  },
  {
    code: 'UNL-NN',
    name: 'Unleashed | Nexus Night',
    released: 'May 2026',
    art: require('@/assets/sets/unleashed.jpg'),
    logo: require('@/assets/set-logos/UNL.webp'),
  },
  {
    code: 'ARC',
    name: 'Arcane Box Set',
    released: 'Dec 2025',
    art: require('@/assets/sets/arcane.jpg'),
    logo: require('@/assets/set-logos/ARC.webp'),
  },
  {
    code: 'WRLD25',
    name: 'Worlds Bundle 2025',
    released: 'Oct 2025',
    art: require('@/assets/sets/worlds-2025.jpg'),
    logo: require('@/assets/set-logos/WRLD25.webp'),
  },
  {
    code: 'VEN',
    name: 'Vendetta',
    released: 'Jul 2026',
    art: require('@/assets/sets/vendetta.jpg'),
    logo: require('@/assets/set-logos/VEN.webp'),
  },
  {
    code: 'VEN-NN',
    name: 'Vendetta | Nexus Night',
    released: 'Jul 2026',
    art: require('@/assets/sets/vendetta.jpg'),
    logo: require('@/assets/set-logos/VEN-NN.webp'),
  },
  {
    code: 'RAD',
    name: 'Radiance',
    released: 'Oct 2026',
    art: require('@/assets/sets/radiance.jpg'),
    logo: require('@/assets/set-logos/RAD.webp'),
  },
];

export function getSetCatalogEntry(code: string): SetCatalogEntry | undefined {
  const normalized = code.trim().toUpperCase();
  return SET_CATALOG.find((s) => s.code.toUpperCase() === normalized);
}
