import type { ReactNode } from 'react';
import { View } from 'react-native';
import { getKeywordBadgeClassName, getKeywordInkClassName } from '@/lib/card-keywords';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const KEYWORD_SKEW_DEG = -10;

export function KeywordBadge({
  label,
  keywordBase,
  compact = false,
  trailing,
}: {
  label: string;
  keywordBase?: string;
  compact?: boolean;
  trailing?: ReactNode;
}) {
  const base = keywordBase ?? label;

  return (
    <View
      className={cn(
        'mx-0.5 flex-row items-center justify-center',
        getKeywordBadgeClassName(base)
      )}
      style={{
        transform: [{ skewX: `${KEYWORD_SKEW_DEG}deg` }],
        paddingHorizontal: compact ? 5 : 6,
        paddingVertical: compact ? 1 : 2,
        gap: trailing ? (compact ? 3 : 4) : 0,
      }}
    >
      <Text
        className={cn(
          'font-extrabold uppercase italic tracking-wide',
          getKeywordInkClassName(base),
          compact ? 'text-[9px] leading-[12px]' : 'text-[10px] leading-[13px]'
        )}
        style={{ transform: [{ skewX: `${-KEYWORD_SKEW_DEG}deg` }] }}
      >
        {label.toUpperCase()}
      </Text>
      {trailing ? (
        <View
          className="flex-row items-center"
          style={{
            transform: [{ skewX: `${-KEYWORD_SKEW_DEG}deg` }],
            gap: compact ? 2 : 3,
          }}
        >
          {trailing}
        </View>
      ) : null}
    </View>
  );
}
