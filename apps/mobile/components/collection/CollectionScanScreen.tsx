import { useCallback } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import type { CardListItem } from '@riftbound/contracts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { ScanCameraFrame } from '@/components/collection/ScanCameraFrame';
import { ScanCameraPhoto } from '@/components/collection/ScanCameraPhoto';
import { CameraIcon, XIcon } from '@/components/icons';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { useCollectionMutations } from '@/hooks/useCollection';
import { useScanSession } from '@/hooks/useScanSession';
import { useScannerEngine } from '@/hooks/useScannerEngine';
import { normalScanInput } from '@/lib/scan-confirmation';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { PREVIEW_ASPECT } from '@/utils/scanCrop';

const THUMB_WIDTH = 48;
const CONFIRM_ART_WIDTH = 320;

export function CollectionScanScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { engine, level, loaded: engineLoaded } = useScannerEngine();
  const { addCard } = useCollectionMutations();
  const saveCard = useCallback(
    async (card: CardListItem) => {
      await addCard.mutateAsync(normalScanInput(card));
    },
    [addCard.mutateAsync]
  );
  const session = useScanSession({ onConfirm: saveCard });

  if (!permission || !engineLoaded) return <View className="flex-1 bg-background" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
        <CameraIcon size={32} className="text-muted-foreground" />
        <Text className="text-center text-xl font-semibold text-foreground">
          Scan a card
        </Text>
        <Text className="text-center text-sm leading-snug text-muted-foreground">
          Allow camera access to recognize your cards. Photos stay on your device.
        </Text>
        <View className="w-full gap-2">
          <Button
            onPress={() =>
              void (permission.canAskAgain
                ? requestPermission()
                : Linking.openSettings())
            }
          >
            <ButtonText>
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </ButtonText>
          </Button>
          <Button variant="outline" onPress={() => router.back()}>
            <ButtonText>Back</ButtonText>
          </Button>
        </View>
      </View>
    );
  }

  const CameraSurface = engine === 'frame' ? ScanCameraFrame : ScanCameraPhoto;
  const previewWidth = Math.max(
    0,
    Math.min(width, (height - insets.top - insets.bottom - 180) * PREVIEW_ASPECT)
  );

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <View
        className="flex-1"
        accessibilityElementsHidden={Boolean(session.pending)}
        importantForAccessibility={session.pending ? 'no-hide-descendants' : 'auto'}
      >
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-lg font-semibold text-foreground">
            Scan to collection
          </Text>
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel="Close scanner"
            disabled={session.saving}
            onPress={() => router.back()}
          >
            <XIcon size={20} className="text-foreground" />
          </Button>
        </View>
        <View className="min-h-0 flex-1 items-center justify-center overflow-hidden">
          <View style={{ width: previewWidth }}>
            <CameraSurface session={session} level={level} active={focused} />
          </View>
        </View>
        <View className="gap-2 border-t border-border px-4 pt-4">
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-base font-semibold text-foreground"
          >
            {session.justAdded
              ? `Added ${session.justAdded}`
              : 'Ready for the next card'}
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            Confirm each match to add one normal copy. No foil scanning yet.
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            {session.totalCopies.toLocaleString()} added this session
          </Text>
        </View>
      </View>
      {session.pending ? (
        <View
          accessibilityViewIsModal
          className="absolute inset-0 bg-background"
          style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {session.pending.kind === 'card' ? (
            <ConfirmCard
              card={session.pending.card}
              saving={session.saving}
              error={session.error}
              onYes={() => void session.confirmPending()}
              onNo={session.rejectPending}
            />
          ) : (
            <PrintingPicker
              name={session.pending.name}
              options={session.pending.options}
              onPick={session.selectPrinting}
              onSkip={session.rejectPending}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function ConfirmCard({
  card,
  saving,
  error,
  onYes,
  onNo,
}: {
  card: CardListItem;
  saving: boolean;
  error: string | null;
  onYes: () => void;
  onNo: () => void;
}) {
  const uri = card.imageUrl ? resolveImageUrl(card.imageUrl) : '';
  const { width, height } = useWindowDimensions();
  const artWidth = Math.min(260, width * 0.6, height * 0.32);
  return (
    <View className="flex-1 gap-4 px-4 pt-4">
      <Text className="text-center text-xl font-semibold text-foreground">
        Is this the card you scanned?
      </Text>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow items-center justify-center gap-4 py-4"
      >
        <View
          className={cn(
            'aspect-[5/7] overflow-hidden border border-border bg-card-panel',
            CARD_ART_RADIUS_CLASS
          )}
          style={{ width: artWidth }}
        >
          {uri ? (
            <CardArtImage
              uri={uri}
              recyclingKey={card.variantNumber}
              className="h-full w-full"
              contentFit="contain"
              transition={0}
              instant
              thumbWidth={CONFIRM_ART_WIDTH}
            />
          ) : null}
        </View>
        <View className="gap-1">
          <Text className="text-center text-xl font-semibold text-foreground">
            {card.name}
          </Text>
          <Text className="text-center font-mono text-xs text-muted-foreground">
            {card.setCode} · {card.variantNumber} · {card.rarity}
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            Adds 1 normal copy to your collection
          </Text>
        </View>
        {error ? (
          <Text
            accessibilityRole="alert"
            className="text-center text-sm text-destructive"
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          className="h-16 w-auto flex-1"
          accessibilityLabel="No, scan again"
          disabled={saving}
          onPress={onNo}
        >
          <ButtonText>No</ButtonText>
        </Button>
        <Button
          className="h-16 w-auto flex-[1.4]"
          accessibilityLabel={`Yes, add one normal copy of ${card.name}`}
          busy={saving}
          onPress={onYes}
        >
          <ButtonText>{saving ? 'Adding…' : 'Yes, add card'}</ButtonText>
        </Button>
      </View>
    </View>
  );
}

function PrintingPicker({
  name,
  options,
  onPick,
  onSkip,
}: {
  name: string;
  options: CardListItem[];
  onPick: (card: CardListItem) => void;
  onSkip: () => void;
}) {
  return (
    <View className="flex-1 gap-3 px-4 pt-3">
      <View className="gap-1">
        <Text className="text-xl font-semibold text-foreground">{name}</Text>
        <Text className="text-sm leading-snug text-muted-foreground">
          Could not read the number at the bottom, and {options.length.toLocaleString()}{' '}
          printings look like this — which one is it?
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {options.map((card) => (
          <Pressable
            key={card.variantNumber}
            accessibilityRole="button"
            accessibilityLabel={`${card.setCode} ${card.variantNumber}`}
            onPress={() => onPick(card)}
            className="flex-row items-center gap-3 rounded-[3px] border border-border px-3 py-2.5 active:bg-card-panel"
          >
            <Thumb uri={card.imageUrl} recyclingKey={card.variantNumber} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                {card.setCode} · {card.variantType ?? 'Standard'}
              </Text>
              <Text className="font-mono text-[11px] text-muted-foreground">
                {card.variantNumber} · {card.rarity}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Button variant="outline" onPress={onSkip}>
        <ButtonText>None of these — keep scanning</ButtonText>
      </Button>
    </View>
  );
}

function Thumb({ uri, recyclingKey }: { uri: string | null; recyclingKey: string }) {
  const resolved = uri ? resolveImageUrl(uri) : '';
  return (
    <View
      className={cn(
        'h-14 w-10 shrink-0 overflow-hidden border border-border bg-card-panel',
        CARD_ART_RADIUS_CLASS
      )}
    >
      {resolved ? (
        <CardArtImage
          uri={resolved}
          recyclingKey={recyclingKey}
          className="h-full w-full"
          contentFit="cover"
          contentPosition="top"
          transition={0}
          priority="low"
          instant
          thumbWidth={THUMB_WIDTH}
        />
      ) : null}
    </View>
  );
}
