import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { CardListItem } from '@riftbound/contracts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardArtImage } from '@/components/cards/CardArtImage';
import {
  ImportPreviewBody,
  type ImportPreviewData,
} from '@/components/collection/ImportPreviewBody';
import { ScanCameraFrame } from '@/components/collection/ScanCameraFrame';
import { ScanCameraPhoto } from '@/components/collection/ScanCameraPhoto';
import { CameraIcon, CheckIcon, MinusIcon, PlusIcon, XIcon } from '@/components/icons';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast.api';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { useCollectionImportExport } from '@/hooks/useCollectionImportExport';
import {
  useScanSession,
  type MatchKind,
  type ScannedCard,
} from '@/hooks/useScanSession';
import { useScannerEngine } from '@/hooks/useScannerEngine';
import { cn } from '@/lib/utils';
import { openCard } from '@/utils/cardNavigation';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { hapticPress } from '@/utils/haptics';

const THUMB_WIDTH = 48;
const CONFIRM_ART_WIDTH = 320;

type Step = 'idle' | 'scanning' | 'review';

export default function CollectionScanRoute() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const lookup = mode === 'lookup';

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>(lookup ? 'scanning' : 'idle');
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const { engine, level, loaded: engineLoaded } = useScannerEngine();

  /**
   * Lookup mode is one-shot. `replace` rather than back-then-push: the two would race,
   * and it leaves the scanner out of the back stack so dismissing the card returns to
   * search, where the scan started.
   */
  const openScannedCard = useCallback(
    (card: CardListItem) => {
      openCard(router, card.variantNumber, 'modal', 'catalog', queryClient, 'replace');
    },
    [queryClient]
  );

  const session = useScanSession(lookup ? { onCard: openScannedCard } : {});
  const { previewItems, acceptTts } = useCollectionImportExport();

  const granted = permission?.granted ?? false;
  // Paused whenever a card is waiting on an answer, or we are not on the camera step.
  const cameraActive = granted && step === 'scanning' && !session.pending;

  const handleReview = async () => {
    void hapticPress();
    try {
      const result = await previewItems.mutateAsync(
        session.staged.map((row) => ({
          variantNumber: row.variantNumber,
          quantity: row.quantity,
          condition: 'near_mint' as const,
          language: 'en',
        }))
      );
      setPreview(result);
      setStep('review');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not preview scan.');
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    try {
      await acceptTts.mutateAsync(preview.items);
      toast.success(
        `Added ${preview.totalCopies.toLocaleString()} copies across ${preview.uniquePrintings.toLocaleString()} printings.`
      );
      session.reset();
      setPreview(null);
      router.back();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import cards.');
    }
  };

  if (!permission || !engineLoaded) return <View className="flex-1 bg-background" />;

  if (!granted) {
    return (
      <Screen insets={insets}>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <CameraIcon size={32} className="text-muted-foreground" />
          <Text className="text-center text-sm leading-snug text-muted-foreground">
            Scanning reads the card with Apple Vision, entirely on this device — no
            photo leaves your phone.
          </Text>
          <View className="w-full gap-2">
            <Button onPress={() => void requestPermission()}>
              <ButtonText>Allow camera</ButtonText>
            </Button>
            <Button variant="outline" onPress={() => router.back()}>
              <ButtonText>Back</ButtonText>
            </Button>
          </View>
        </View>
      </Screen>
    );
  }

  if (step === 'idle') {
    return (
      <Screen insets={insets}>
        <View className="flex-1 items-center justify-center gap-5 px-8">
          <CameraIcon size={40} className="text-foreground" />
          <View className="gap-2">
            <Text className="text-center text-xl font-semibold text-foreground">
              Scan cards in
            </Text>
            <Text className="text-center text-sm leading-snug text-muted-foreground">
              Hold each card in the frame. You confirm every card before it counts, and
              nothing is written to your collection until you finish.
            </Text>
          </View>
          <View className="w-full gap-2">
            <Button
              onPress={() => {
                void hapticPress();
                setStep('scanning');
              }}
            >
              <ButtonText>Start scanning</ButtonText>
            </Button>
            <Button variant="outline" onPress={() => router.back()}>
              <ButtonText>Cancel</ButtonText>
            </Button>
          </View>
          <Text className="font-mono text-[11px] text-muted-foreground">
            Engine: {engine === 'frame' ? 'frame processor' : 'photo capture'} · {level}
          </Text>
        </View>
      </Screen>
    );
  }

  if (step === 'review' && preview) {
    return (
      <Screen insets={insets}>
        <View className="flex-1 gap-3 px-4 pt-3">
          <Text className="text-lg font-semibold text-foreground">Review scan</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <ImportPreviewBody preview={preview} totalLabel="cards scanned" />
          </ScrollView>
          <View className="flex-row items-center gap-2">
            <Button
              variant="outline"
              className="w-auto flex-1"
              disabled={acceptTts.isPending}
              onPress={() => {
                setPreview(null);
                setStep('scanning');
              }}
            >
              <ButtonText>Keep scanning</ButtonText>
            </Button>
            <Button
              className="w-auto flex-[1.4]"
              busy={acceptTts.isPending}
              onPress={() => void handleConfirmImport()}
            >
              <ButtonText>
                {acceptTts.isPending ? 'Importing…' : 'Confirm import'}
              </ButtonText>
            </Button>
          </View>
        </View>
      </Screen>
    );
  }

  if (session.pending?.kind === 'card') {
    return (
      <Screen insets={insets}>
        <ConfirmCard
          card={session.pending.card}
          via={session.pending.via}
          onYes={session.confirmPending}
          onNo={session.rejectPending}
        />
      </Screen>
    );
  }

  if (session.pending?.kind === 'ambiguous') {
    return (
      <Screen insets={insets}>
        <PrintingPicker
          name={session.pending.name}
          options={session.pending.options}
          onPick={session.accept}
          onSkip={session.rejectPending}
        />
      </Screen>
    );
  }

  const CameraSurface = engine === 'frame' ? ScanCameraFrame : ScanCameraPhoto;

  return (
    <View className="flex-1 bg-background">
      <View style={{ marginTop: insets.top }}>
        <CameraSurface session={session} level={level} active={cameraActive} />

        <Pressable
          accessibilityLabel="Close scanner"
          accessibilityRole="button"
          onPress={() => router.back()}
          className="absolute left-3 top-3 h-10 w-10 items-center justify-center rounded-[3px] bg-background/70"
        >
          <XIcon size={20} className="text-foreground" />
        </Pressable>
      </View>

      {lookup ? null : (
        <View
          className="flex-1 gap-3 border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <StagedList staged={session.staged} onSetQuantity={session.setQuantity} />
          </ScrollView>
          <Button
            disabled={session.staged.length === 0 || previewItems.isPending}
            busy={previewItems.isPending}
            onPress={() => void handleReview()}
          >
            <ButtonText>
              {session.staged.length === 0
                ? 'Scan a card to begin'
                : `Finish · ${session.totalCopies.toLocaleString()} scanned`}
            </ButtonText>
          </Button>
        </View>
      )}
    </View>
  );
}

function Screen({
  insets,
  children,
}: {
  insets: { top: number; bottom: number };
  children: React.ReactNode;
}) {
  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {children}
    </View>
  );
}

/** The yes/no gate. Deliberately two big targets — this is tapped once per card. */
function ConfirmCard({
  card,
  via,
  onYes,
  onNo,
}: {
  card: CardListItem;
  via: MatchKind;
  onYes: () => void;
  onNo: () => void;
}) {
  const uri = card.imageUrl ? resolveImageUrl(card.imageUrl) : '';

  return (
    <View className="flex-1 justify-between gap-4 px-4 pt-3">
      <View className="min-h-0 flex-1 items-center justify-center gap-4">
        <View
          className={cn(
            'aspect-[5/7] w-[68%] overflow-hidden border border-border bg-card-panel',
            CARD_ART_RADIUS_CLASS
          )}
        >
          {uri ? (
            <CardArtImage
              uri={uri}
              recyclingKey={card.variantNumber}
              className="h-full w-full"
              contentFit="cover"
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
          <Text className="text-center font-mono text-[12px] text-muted-foreground">
            {card.setCode} · {card.variantNumber} · {card.rarity}
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-center text-sm text-muted-foreground">
          {via === 'code'
            ? 'Is this the card you scanned?'
            : 'Matched on name — check the printing is right.'}
        </Text>
        <View className="flex-row items-stretch gap-3">
          <Pressable
            accessibilityLabel="No, this is the wrong card"
            accessibilityRole="button"
            onPress={onNo}
            className="h-16 flex-1 flex-row items-center justify-center gap-2 rounded-[3px] border border-border bg-card-panel active:bg-background"
          >
            <XIcon size={22} className="text-foreground" />
            <Text className="text-base font-semibold text-foreground">No</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Yes, add ${card.name}`}
            accessibilityRole="button"
            onPress={onYes}
            className="h-16 flex-[1.4] flex-row items-center justify-center gap-2 rounded-[3px] bg-cta active:opacity-80"
          >
            <CheckIcon size={22} className="text-cta-foreground" />
            <Text className="text-base font-bold text-cta-foreground">Yes, add</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Shown when the name matched but the collector code did not. Over half the catalog
 * shares a name with another printing, so guessing one would quietly add the wrong
 * card — one tap is cheaper than an import to unpick later.
 */
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
          Could not read the number at the bottom. This name has{' '}
          {options.length.toLocaleString()} printings — which one is it?
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

function StagedList({
  staged,
  onSetQuantity,
}: {
  staged: ScannedCard[];
  onSetQuantity: (variantNumber: string, quantity: number) => void;
}) {
  if (staged.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-muted-foreground">
        Hold a card up. You will be asked to confirm each one.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {staged.map((row) => (
        <View
          key={row.variantNumber}
          className="flex-row items-center gap-3 rounded-[3px] border border-border px-3 py-2"
        >
          <Thumb uri={row.imageUrl} recyclingKey={row.variantNumber} />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
              {row.name}
            </Text>
            <Text className="font-mono text-[11px] text-muted-foreground">
              {row.setCode} · {row.variantNumber}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <QtyButton
              label={`Remove one ${row.name}`}
              onPress={() => onSetQuantity(row.variantNumber, row.quantity - 1)}
            >
              <MinusIcon size={14} className="text-foreground" />
            </QtyButton>
            <Text className="min-w-6 text-center font-mono text-[13px] tabular-nums text-foreground">
              {row.quantity}
            </Text>
            <QtyButton
              label={`Add one ${row.name}`}
              onPress={() => onSetQuantity(row.variantNumber, row.quantity + 1)}
            >
              <PlusIcon size={14} className="text-foreground" />
            </QtyButton>
          </View>
        </View>
      ))}
    </View>
  );
}

function QtyButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => {
        void hapticPress();
        onPress();
      }}
      className="h-7 w-7 items-center justify-center rounded-[3px] bg-card-panel active:bg-background"
    >
      {children}
    </Pressable>
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
