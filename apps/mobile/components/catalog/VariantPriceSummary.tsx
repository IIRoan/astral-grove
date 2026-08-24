import { TrendTag } from '@/components/catalog/TrendTag';
import { Text } from '@/components/ui/text';
import {
  DETAIL_PRINTING_LABEL_CLASS,
  DETAIL_PRINTING_PRICE_CLASS,
} from '@/constants/operateType';
import { View } from 'react-native';

interface VariantPriceSummaryProps {
  label: string;
  price: string;
  trend: string;
  className?: string;
  hideLabel?: boolean;
}

export function VariantPriceSummary({
  label,
  price,
  trend,
  className,
  hideLabel = false,
}: VariantPriceSummaryProps) {
  const showLabel = !hideLabel && label !== 'Standard';

  return (
    <View
      className={`mt-2 flex-row flex-wrap items-center gap-x-2 gap-y-1 ${className ?? ''}`}
    >
      {showLabel ? (
        <>
          <Text className={DETAIL_PRINTING_LABEL_CLASS}>{label}</Text>
          <Text className="text-sm text-muted-foreground">·</Text>
        </>
      ) : null}
      <Text className={DETAIL_PRINTING_PRICE_CLASS}>{price}</Text>
      <TrendTag trend={trend} />
    </View>
  );
}
