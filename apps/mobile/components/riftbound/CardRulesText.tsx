import { Image } from 'expo-image';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Platform, Text as RNText, View } from 'react-native';
import { splitReminderText } from '@/components/riftbound/cardRulesText.utils';
import { KeywordBadge } from '@/components/riftbound/KeywordBadge';
import { Text } from '@/components/ui/text';
import { domainIconFor, mightIcon, runeIcon, tapIcon } from '@/constants/gameAssets';
import {
  cardRulesPartKey,
  groupParagraphSegments,
  KEYWORD_BANNER_COST_BASES,
  parseCardRules,
  splitRuleParagraphs,
  takeKeywordBannerCosts,
  type CardRulesPart,
  type ParagraphSegment,
} from '@/lib/card-rules';
import { cn } from '@/lib/utils';
import { keySlug } from '@/lib/react-list-keys';

function iconSize(compact?: boolean) {
  return compact ? 14 : 16;
}

function InlineAssetIcon({
  source,
  size,
  label,
}: {
  source: ImageSourcePropType;
  size: number;
  label: string;
}) {
  return (
    <View
      className="mx-0.5 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image
        source={source}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel={label}
      />
    </View>
  );
}

function InlineDomainIcon({ name, size }: { name: string; size: number }) {
  const source = domainIconFor(name);
  if (!source) return null;
  return <InlineAssetIcon source={source} size={size} label={name} />;
}

function InlineEnergyText({ value, compact }: { value: string; compact?: boolean }) {
  const size = iconSize(compact);

  return (
    <View
      className="mx-0.5 items-center justify-center rounded-full border border-black/25 bg-white"
      style={{ width: size, height: size, minWidth: size, backgroundColor: '#FFFFFF' }}
      accessibilityLabel={`${value} energy`}
    >
      <Text
        className="text-center font-extrabold"
        style={{ fontSize: size * 0.55, lineHeight: size * 0.65, color: '#000000' }}
      >
        {value}
      </Text>
    </View>
  );
}

function BannerBadgeEnergy({ value, compact }: { value: string; compact?: boolean }) {
  const size = compact ? 12 : 14;

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        minWidth: size,
        backgroundColor: '#FFFFFF',
      }}
      accessibilityLabel={`${value} energy`}
    >
      <Text
        className="text-center font-extrabold"
        style={{ fontSize: size * 0.55, lineHeight: size * 0.65, color: '#000000' }}
      >
        {value}
      </Text>
    </View>
  );
}

/** Keyword-banner domain icons print white; reminder restatements stay full-color. */
function KeywordBannerCostIcon({
  source,
  size,
  label,
}: {
  source: ImageSourcePropType;
  size: number;
  label: string;
}) {
  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Image
        source={source}
        className={Platform.OS === 'web' ? 'brightness-0 invert' : undefined}
        style={{
          width: size,
          height: size,
          ...(Platform.OS !== 'web' ? { tintColor: '#FFFFFF' } : {}),
        }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel={label}
      />
    </View>
  );
}

function ReminderText({
  value,
  textClass,
  reminderClass,
}: {
  value: string;
  textClass: string;
  reminderClass: string;
}) {
  const chunks = splitReminderText(value);

  if (chunks.length === 1 && !chunks[0]?.reminder) {
    return (
      <Text className={cn(textClass, 'shrink')}>
        <RNText>{value}</RNText>
      </Text>
    );
  }

  return (
    <Text className={cn(textClass, 'shrink')}>
      {(() => {
        let offset = 0;
        return chunks.map((chunk) => {
          const key = `${chunk.reminder ? 'reminder' : 'text'}@${offset}:${keySlug(chunk.value, 32)}`;
          offset += chunk.value.length;
          return (
            <RNText key={key} className={chunk.reminder ? reminderClass : undefined}>
              {chunk.value}
            </RNText>
          );
        });
      })()}
    </Text>
  );
}

function RulesPartView({
  part,
  compact,
  textClass,
  reminderClass,
}: {
  part: CardRulesPart;
  compact?: boolean;
  textClass: string;
  reminderClass: string;
}) {
  if (part.type === 'text') {
    return (
      <ReminderText
        value={part.value}
        textClass={textClass}
        reminderClass={reminderClass}
      />
    );
  }

  if (part.type === 'keyword') {
    return (
      <KeywordBadge
        label={part.display}
        keywordBase={part.keywordBase}
        compact={compact}
      />
    );
  }

  if (part.type === 'energy') {
    return <InlineEnergyText value={part.value} compact={compact} />;
  }

  if (
    part.type === 'might' ||
    part.type === 'tap' ||
    part.type === 'rune' ||
    part.type === 'domain'
  ) {
    const size = iconSize(compact);

    if (part.type === 'might') {
      return <InlineAssetIcon source={mightIcon} size={size} label="Might" />;
    }
    if (part.type === 'tap') {
      return <InlineAssetIcon source={tapIcon} size={size} label="Tap" />;
    }
    if (part.type === 'rune') {
      return <InlineAssetIcon source={runeIcon} size={size} label="Rune" />;
    }
    return <InlineDomainIcon name={part.value} size={size} />;
  }

  const display =
    part.value.toLowerCase() === 'might'
      ? 'Might'
      : part.value.toLowerCase() === 'energy'
        ? 'Energy'
        : part.value.toLowerCase() === 'power'
          ? 'Power'
          : part.value;

  return (
    <Text className={cn(textClass, 'shrink')}>
      <RNText className={cn('font-bold', compact ? 'text-[10px]' : 'text-xs')}>
        {display}
      </RNText>
    </Text>
  );
}

function KeywordBannerCluster({
  label,
  keywordBase,
  costs,
  compact,
}: {
  label: string;
  keywordBase: string;
  costs: CardRulesPart[];
  compact?: boolean;
}) {
  const size = compact ? 12 : 14;
  let costPath = `${label}-${keywordBase}`;
  const trailing =
    costs.length > 0
      ? costs.map((cost) => {
          const key = `${costPath}/${cardRulesPartKey(cost)}`;
          costPath = key;
          if (cost.type === 'energy') {
            return <BannerBadgeEnergy key={key} value={cost.value} compact={compact} />;
          }
          if (cost.type === 'rune') {
            return (
              <KeywordBannerCostIcon
                key={key}
                source={runeIcon}
                size={size}
                label="Rune"
              />
            );
          }
          if (cost.type === 'domain') {
            const source = domainIconFor(cost.value);
            if (!source) return null;
            return (
              <KeywordBannerCostIcon
                key={key}
                source={source}
                size={size}
                label={cost.value}
              />
            );
          }
          return null;
        })
      : undefined;

  return (
    <KeywordBadge
      label={label}
      keywordBase={keywordBase}
      compact={compact}
      trailing={trailing}
    />
  );
}

function InlineSegmentRow({
  parts,
  compact,
  textClass,
  reminderClass,
}: {
  parts: CardRulesPart[];
  compact?: boolean;
  textClass: string;
  reminderClass: string;
}) {
  const nodes = [];
  let index = 0;
  let siblingPath = 'segment';

  while (index < parts.length) {
    const part = parts[index]!;

    if (part.type === 'keyword' && KEYWORD_BANNER_COST_BASES.has(part.keywordBase)) {
      const { costs, nextIndex } = takeKeywordBannerCosts(parts, index + 1);
      const key = `${siblingPath}/${cardRulesPartKey(part)}`;
      siblingPath = key;
      nodes.push(
        <KeywordBannerCluster
          key={key}
          label={part.display}
          keywordBase={part.keywordBase}
          costs={costs}
          compact={compact}
        />
      );
      index = nextIndex;
      continue;
    }

    const key = `${siblingPath}/${cardRulesPartKey(part)}`;
    siblingPath = key;
    nodes.push(
      <RulesPartView
        key={key}
        part={part}
        compact={compact}
        textClass={textClass}
        reminderClass={reminderClass}
      />
    );
    index++;
  }

  return <View className="max-w-full flex-row flex-wrap items-center">{nodes}</View>;
}

function ParagraphSegmentView({
  segment,
  compact,
  textClass,
  reminderClass,
}: {
  segment: ParagraphSegment;
  compact?: boolean;
  textClass: string;
  reminderClass: string;
}) {
  return (
    <InlineSegmentRow
      parts={segment.parts}
      compact={compact}
      textClass={textClass}
      reminderClass={reminderClass}
    />
  );
}

interface CardRulesTextProps {
  text: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  numberOfLines?: number;
}

export function CardRulesText({
  text,
  style,
  compact = false,
  numberOfLines,
}: CardRulesTextProps) {
  const paragraphs = splitRuleParagraphs(text);
  const textClass = cn(
    'font-medium text-foreground',
    compact ? 'text-[11.5px] leading-[17px]' : 'text-[13px] leading-[21px]'
  );
  const reminderClass = 'italic text-muted-foreground';
  const lineHeight = compact ? 17 : 21;

  return (
    <View
      style={[
        style,
        numberOfLines
          ? { maxHeight: numberOfLines * lineHeight, overflow: 'hidden' }
          : undefined,
      ]}
    >
      {paragraphs.map((paragraph, paragraphIndex) => {
        if (!paragraph) {
          return paragraphIndex > 0 ? (
            <View key={paragraphIndex} className="h-1" />
          ) : null;
        }

        const segments = groupParagraphSegments(parseCardRules(paragraph));

        return (
          <View
            key={paragraphIndex}
            className={cn(
              'max-w-full flex-row flex-wrap items-center',
              paragraphIndex > 0 ? 'mt-1.5' : undefined
            )}
          >
            {segments.map((segment, segmentIndex) => (
              <ParagraphSegmentView
                key={segmentIndex}
                segment={segment}
                compact={compact}
                textClass={textClass}
                reminderClass={reminderClass}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
