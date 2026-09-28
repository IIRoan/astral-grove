import type { ImageSourcePropType } from 'react-native';
import { SET_DIRECTORY } from '@/constants/setDirectory';

export type SetCatalogEntry = {
  code: string;
  name: string;
  released: string;
  art: ImageSourcePropType;
  logo?: ImageSourcePropType;
};

const SET_ART: Record<
  string,
  { art: ImageSourcePropType; logo?: ImageSourcePropType }
> = {
  OGN: {
    art: require('@/assets/sets/origins.png'),
    logo: require('@/assets/set-logos/OGN.webp'),
  },
  SFD: {
    art: require('@/assets/sets/spiritforged.jpg'),
    logo: require('@/assets/set-logos/SFD.webp'),
  },
  UNL: {
    art: require('@/assets/sets/unleashed.jpg'),
    logo: require('@/assets/set-logos/UNL.webp'),
  },
  OGS: {
    art: require('@/assets/sets/proving-grounds.jpg'),
    logo: require('@/assets/set-logos/OGS.webp'),
  },
  'OGN-NN': {
    art: require('@/assets/sets/origins.png'),
    logo: require('@/assets/set-logos/OGN-NN.webp'),
  },
  'SFD-NN': {
    art: require('@/assets/sets/spiritforged.jpg'),
    logo: require('@/assets/set-logos/SFD-NN.webp'),
  },
  'UNL-NN': {
    art: require('@/assets/sets/unleashed.jpg'),
    logo: require('@/assets/set-logos/UNL.webp'),
  },
  ARC: {
    art: require('@/assets/sets/arcane.jpg'),
    logo: require('@/assets/set-logos/ARC.webp'),
  },
  WRLD25: {
    art: require('@/assets/sets/worlds-2025.jpg'),
    logo: require('@/assets/set-logos/WRLD25.webp'),
  },
  VEN: {
    art: require('@/assets/sets/vendetta.jpg'),
    logo: require('@/assets/set-logos/VEN.webp'),
  },
  'VEN-NN': {
    art: require('@/assets/sets/vendetta.jpg'),
    logo: require('@/assets/set-logos/VEN-NN.webp'),
  },
  RAD: {
    art: require('@/assets/sets/radiance.jpg'),
    logo: require('@/assets/set-logos/RAD.webp'),
  },
};

/** Optional local set art/labels; dashboard set list comes from `/api/v1/filters` (PA sync). */
export const SET_CATALOG: SetCatalogEntry[] = SET_DIRECTORY.map((entry) => {
  const media = SET_ART[entry.code];
  if (!media) {
    throw new Error(`Missing set art for ${entry.code}`);
  }
  return {
    ...entry,
    art: media.art,
    ...(media.logo ? { logo: media.logo } : {}),
  };
});

export function getSetCatalogEntry(code: string): SetCatalogEntry | undefined {
  const normalized = code.trim().toUpperCase();
  return SET_CATALOG.find((s) => s.code.toUpperCase() === normalized);
}
