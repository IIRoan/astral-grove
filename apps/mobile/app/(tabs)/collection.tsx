import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  BreakdownSection,
  DashboardStat,
  DashboardStatGrid,
  SetCardGrid,
} from '@/components/collection/CollectionDashboard';
import { computeTypeStats } from '@/utils/collectionDashboardStats';
import { rarityIconFor, typeIconFor } from '@/constants/gameAssets';
import { CollectionCardList } from '@/components/collection/CollectionCardList';
import {
  CollectionImportExportStatus,
  CollectionImportExportToolbar,
} from '@/components/collection/CollectionImportExportActions';
import { SharedCollectionBanner } from '@/components/collection/SharedCollectionBanner';
import {
  ScreenLayout,
  ScreenLayoutBody,
  useScreenLayout,
} from '@/components/shell/ScreenLayout';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useCollection } from '@/hooks/useCollection';
import { useCollectionInsights } from '@/hooks/useCollectionInsights';
import { useFiltersData } from '@/hooks/useFiltersData';
import { getSetCatalogEntry } from '@/constants/setCatalog';
import {
  catalogCardTotalFromTypes,
  computeRarityBreakdown,
  countUniqueCardNames,
  countUniqueVariants,
  mergeSetStats,
  sumCollectionCopies,
} from '@/utils/collectionStats';

export default function CollectionScreen() {
  return (
    <ScreenLayout mode="flex" contentClassName="flex-1">
      <CollectionScreenBody />
    </ScreenLayout>
  );
}

function CollectionScreenBody() {
  const router = useRouter();
  const { contentWidth, paddingBottomInline } = useScreenLayout();
  const [query, setQuery] = useState('');

  const { data: collection = [], isLoading } = useCollection();
  const filtersQuery = useFiltersData();
  const insightsQuery = useCollectionInsights(collection);

  const totalCopies = useMemo(() => sumCollectionCopies(collection), [collection]);
  const uniqueCards = useMemo(() => countUniqueCardNames(collection), [collection]);
  const uniquePrintings = useMemo(() => countUniqueVariants(collection), [collection]);

  const apiSets = useMemo(
    () =>
      (filtersQuery.data?.sets ?? []).map((s) => ({
        code: s.code ?? s.id,
        name: s.name,
        count: s.printCount ?? s.count,
        ...(s.foilPrintCount != null ? { foilCount: s.foilPrintCount } : {}),
      })),
    [filtersQuery.data?.sets]
  );
  const apiTypes = useMemo(
    () => filtersQuery.data?.types ?? [],
    [filtersQuery.data?.types]
  );
  const apiRarities = useMemo(
    () => filtersQuery.data?.rarities ?? [],
    [filtersQuery.data?.rarities]
  );
  const catalogCardTotal = useMemo(
    () => catalogCardTotalFromTypes(apiTypes),
    [apiTypes]
  );
  const catalogCardLabel =
    catalogCardTotal > 0
      ? catalogCardTotal.toLocaleString()
      : filtersQuery.isLoading
        ? '…'
        : '—';

  const mergedSets = useMemo(
    () => mergeSetStats(collection, apiSets, getSetCatalogEntry),
    [collection, apiSets]
  );

  const rarityStats = useMemo(
    () => computeRarityBreakdown(collection, apiRarities),
    [collection, apiRarities]
  );

  const typeStats = useMemo(
    () => computeTypeStats(collection, apiTypes),
    [collection, apiTypes]
  );

  const completion = catalogCardTotal > 0 ? (uniqueCards / catalogCardTotal) * 100 : 0;
  const estimatedValue = insightsQuery.data?.estimatedValue ?? 0;
  const valueLabel =
    insightsQuery.isLoading && collection.length > 0
      ? '…'
      : `€${estimatedValue.toFixed(2)}`;

  const dashboardHeader = (
    <View className="pb-6">
      <SharedCollectionBanner />
      <View className="mb-8">
        <Text className="text-xl font-semibold tracking-tight text-foreground">
          Collection Dashboard
        </Text>
        <Text className="mt-1 font-mono text-[13px] text-muted-foreground">
          {totalCopies.toLocaleString()} cards · {valueLabel} estimated value
        </Text>
      </View>

      <View className="mb-8">
        <Text className="mb-4 text-sm font-medium text-muted-foreground">Sets</Text>
        <SetCardGrid sets={mergedSets} />
      </View>

      <DashboardStatGrid>
        <DashboardStat
          label="Cards Collected"
          value={uniqueCards.toLocaleString()}
          sub={
            catalogCardTotal > 0
              ? `of ${catalogCardLabel} available`
              : filtersQuery.isLoading
                ? 'loading catalog…'
                : 'catalog count unavailable'
          }
          progress={catalogCardTotal > 0 ? uniqueCards / catalogCardTotal : undefined}
        />
        <DashboardStat
          label="Total Cards"
          value={totalCopies.toLocaleString()}
          sub="including duplicates"
        />
        <DashboardStat
          label="Completion"
          value={`${completion.toFixed(2)}%`}
          sub="overall progress"
          progress={completion / 100}
        />
        <DashboardStat
          label="Estimated Value"
          value={valueLabel}
          sub="based on Cardmarket"
        />
      </DashboardStatGrid>

      <View className="mb-8 gap-4 md:flex-row">
        {apiTypes.length > 0 ? (
          <View className="flex-1">
            <BreakdownSection
              title="Cards by Type"
              stats={typeStats}
              iconFor={typeIconFor}
            />
          </View>
        ) : null}
        {apiRarities.length > 0 ? (
          <View className="flex-1">
            <BreakdownSection
              title="Cards by Rarity"
              stats={rarityStats}
              iconFor={rarityIconFor}
            />
          </View>
        ) : null}
      </View>

      <View className="mb-8 gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-sm font-medium text-muted-foreground">
            Your collection
          </Text>
          <CollectionImportExportToolbar disabled={isLoading} />
        </View>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or variant"
          accessibilityLabel="Search your collection"
          className="min-h-12 rounded-[10px] border-border bg-card"
        />
        <CollectionImportExportStatus disabled={isLoading} />
      </View>

      {collection.length === 0 && !isLoading ? (
        <Button
          className="mb-8"
          onPress={() => {
            router.push('/(tabs)/search');
          }}
        >
          <ButtonText>Search cards</ButtonText>
        </Button>
      ) : null}
    </View>
  );

  return (
    <ScreenLayoutBody>
      <CollectionCardList
        entries={collection}
        query={query}
        isLoading={isLoading}
        contentWidth={contentWidth}
        paddingBottom={paddingBottomInline}
        uniquePrintings={uniquePrintings}
        totalCopies={totalCopies}
        listHeader={dashboardHeader}
      />
    </ScreenLayoutBody>
  );
}
