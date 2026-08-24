import { Image } from 'expo-image';
import { View } from 'react-native';
import { domainIconFor } from '@/constants/gameAssets';
import { AUTH_DOMAINS } from '@/components/auth/authArtifacts.constants';
import { cn } from '@/lib/utils';

export function AuthDomainStrip({
  className,
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <View
      className={cn('flex-row items-center justify-between gap-1', className)}
      accessibilityRole="image"
      accessibilityLabel="Riftbound domains: Fury, Calm, Mind, Body, Chaos, Order"
    >
      {AUTH_DOMAINS.map((domain) => {
        const source = domainIconFor(domain);
        if (!source) return null;
        return (
          <Image
            key={domain}
            source={source}
            style={{ width: size, height: size }}
            contentFit="contain"
            accessibilityLabel={domain}
          />
        );
      })}
    </View>
  );
}

export function AuthSlabCorners() {
  const tick = 'absolute h-3 w-3 border-foreground/45';
  return (
    <>
      <View
        className={cn(tick, 'top-3 left-3 border-t border-l')}
        pointerEvents="none"
      />
      <View
        className={cn(tick, 'top-3 right-3 border-t border-r')}
        pointerEvents="none"
      />
      <View
        className={cn(tick, 'bottom-3 left-3 border-b border-l')}
        pointerEvents="none"
      />
      <View
        className={cn(tick, 'right-3 bottom-3 border-r border-b')}
        pointerEvents="none"
      />
    </>
  );
}
