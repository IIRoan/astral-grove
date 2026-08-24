import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Stack } from '@/components/ui/stack';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export function CardStat({
  label,
  children,
  compact = false,
}: {
  label: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <Stack
      className={cn(
        'flex-1 items-center',
        compact ? 'gap-1 px-2 py-2' : 'gap-1 px-3 py-3'
      )}
    >
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      <View className="items-center">{children}</View>
    </Stack>
  );
}

export function CardAttributeRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-4 border-t border-border py-3">
      <Text className="w-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Text>
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
        {children}
      </View>
    </View>
  );
}

export function CardTag({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="rounded">
      <BadgeText className="text-xs">{label}</BadgeText>
    </Badge>
  );
}

export function CardSectionLabel({ children }: { children: string }) {
  return <Text className="mb-2 text-sm font-semibold text-foreground">{children}</Text>;
}
