import { ThemedIcon, ImageIcon } from '@/components/icons';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/context/ThemeContext';
import {
  isDiskImageCached,
  isSessionImageLoaded,
  markSessionImageLoaded,
} from '@/lib/imageSessionCache';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';

const FADE_MS = 220;
const SHIMMER_MS = 1300;
const SHIMMER_DELAY_MS = 120;

type CardArtImageProps = {
  uri: string | null | undefined;
  recyclingKey: string;
  contentFit?: 'cover' | 'contain';
  contentPosition?: 'top' | 'center';
  transition?: number;
  priority?: 'low' | 'normal' | 'high';
  /** Skip fade/shimmer — for catalog list cells that recycle while scrolling. */
  instant?: boolean;
  /** Low-res ?w= placeholder; omit for detail/fullscreen full-res start. */
  thumbWidth?: number;
  /** With thumbWidth, show thumb while full image loads (false = permanent thumb). */
  progressive?: boolean;
  className?: string;
  imageClassName?: string;
  style?: StyleProp<ViewStyle>;
};

function initialImageStatus(
  uri: string | null | undefined
): 'loading' | 'loaded' | 'error' {
  if (!uri) return 'error';
  return isSessionImageLoaded(uri) ? 'loaded' : 'loading';
}

function CardArtShimmer() {
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || width <= 0) {
      progress.value = 0;
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [progress, reducedMotion, width]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width * 1.4 - width * 0.35 }],
  }));

  return (
    <View
      className="absolute inset-0 overflow-hidden"
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      <Skeleton className="absolute inset-0 rounded-none bg-muted" />
      {!reducedMotion && width > 0 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute top-0 bottom-0 w-[38%] bg-card/75 dark:bg-foreground/10"
          style={[{ left: 0, transform: [{ skewX: '-14deg' }] }, highlightStyle]}
        />
      ) : null}
    </View>
  );
}

function CardArtImageInner({
  uri,
  recyclingKey,
  contentFit = 'cover',
  contentPosition = 'top',
  transition = FADE_MS,
  priority = 'normal',
  instant = false,
  thumbWidth,
  progressive = true,
  className,
  imageClassName,
  style,
}: CardArtImageProps) {
  const { actualTheme } = useTheme();
  const { displayUri, placeholderUri } = useMemo(() => {
    if (!uri) return { displayUri: null, placeholderUri: undefined };

    const fullUri = resolveImageUrl(uri);
    const thumbUri =
      thumbWidth != null ? resolveImageUrl(uri, { width: thumbWidth }) : null;
    const useProgressive = progressive && thumbUri != null && thumbUri !== fullUri;

    if (useProgressive) {
      return { displayUri: fullUri, placeholderUri: thumbUri ?? undefined };
    }

    return {
      displayUri: thumbUri ?? fullUri,
      placeholderUri: undefined,
    };
  }, [progressive, thumbWidth, uri]);

  const sessionCached = Boolean(displayUri && isSessionImageLoaded(displayUri));
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() =>
    initialImageStatus(displayUri)
  );
  const [showShimmer, setShowShimmer] = useState(false);
  const [loaderSuppressed, setLoaderSuppressed] = useState(
    () => instant || (displayUri ? isSessionImageLoaded(displayUri) : true)
  );
  const overlayOpacity = useSharedValue(0);
  const skipLoaderRef = useRef(loaderSuppressed);
  const loadingRef = useRef(false);
  const showShimmerRef = useRef(false);
  const shimmerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayUriRef = useRef(displayUri);

  const clearShimmerTimer = () => {
    if (shimmerTimerRef.current) {
      clearTimeout(shimmerTimerRef.current);
      shimmerTimerRef.current = null;
    }
  };

  const hideShimmer = useCallback(
    (animated: boolean) => {
      showShimmerRef.current = false;
      setShowShimmer(false);
      overlayOpacity.value =
        animated && !instant ? withTiming(0, { duration: FADE_MS }) : 0;
    },
    [instant, overlayOpacity]
  );

  const scheduleShimmer = () => {
    if (instant || skipLoaderRef.current || shimmerTimerRef.current) return;

    shimmerTimerRef.current = setTimeout(() => {
      shimmerTimerRef.current = null;
      if (!loadingRef.current || skipLoaderRef.current) return;
      showShimmerRef.current = true;
      setShowShimmer(true);
      overlayOpacity.value = 1;
    }, SHIMMER_DELAY_MS);
  };

  useEffect(() => {
    if (displayUriRef.current === displayUri) return;
    displayUriRef.current = displayUri;

    clearShimmerTimer();
    loadingRef.current = false;
    setShowShimmer(false);
    overlayOpacity.value = 0;

    if (!displayUri) {
      skipLoaderRef.current = true;
      setLoaderSuppressed(true);
      setStatus('error');
      return;
    }

    const cached =
      instant ||
      isSessionImageLoaded(displayUri) ||
      (placeholderUri != null && isSessionImageLoaded(placeholderUri));
    skipLoaderRef.current = cached;
    setLoaderSuppressed(cached);
    setStatus(cached ? 'loaded' : 'loading');

    if (cached) return;

    let cancelled = false;
    void isDiskImageCached(displayUri).then((diskCached) => {
      if (cancelled || !diskCached) return;
      skipLoaderRef.current = true;
      setLoaderSuppressed(true);
      setStatus('loaded');
      hideShimmer(false);
    });

    return () => {
      cancelled = true;
      clearShimmerTimer();
    };
  }, [displayUri, hideShimmer, instant, overlayOpacity, placeholderUri]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const showPlaceholderBg = !loaderSuppressed && status !== 'loaded' && !sessionCached;
  const imageTransition =
    instant || loaderSuppressed
      ? 0
      : progressive && placeholderUri
        ? transition
        : transition;

  return (
    <View
      className={cn(
        'relative overflow-hidden',
        showPlaceholderBg ? 'bg-muted' : 'bg-transparent',
        className
      )}
      style={style}
    >
      {showShimmer ? (
        <Animated.View
          key={actualTheme}
          pointerEvents="none"
          className="absolute inset-0 z-10"
          style={overlayStyle}
        >
          <CardArtShimmer />
        </Animated.View>
      ) : null}

      {displayUri && status !== 'error' ? (
        <Image
          source={{ uri: displayUri, cacheKey: displayUri }}
          placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
          placeholderContentFit={contentFit}
          recyclingKey={recyclingKey}
          style={{ width: '100%', height: '100%' }}
          className={cn('absolute inset-0', imageClassName)}
          contentFit={contentFit}
          contentPosition={contentPosition}
          transition={imageTransition}
          cachePolicy="memory-disk"
          priority={priority}
          onLoadStart={() => {
            if (skipLoaderRef.current) return;
            loadingRef.current = true;
            setStatus('loading');
            scheduleShimmer();
          }}
          onLoad={() => {
            loadingRef.current = false;
            clearShimmerTimer();
            if (displayUri) {
              markSessionImageLoaded(displayUri);
            }
            if (placeholderUri) {
              markSessionImageLoaded(placeholderUri);
            }
            skipLoaderRef.current = true;
            setLoaderSuppressed(true);
            hideShimmer(showShimmerRef.current);
            setStatus('loaded');
          }}
          onError={() => {
            loadingRef.current = false;
            clearShimmerTimer();
            hideShimmer(false);
            setStatus('error');
          }}
        />
      ) : null}

      {status === 'error' ? (
        <View className="absolute inset-0 items-center justify-center bg-muted">
          <ThemedIcon icon={ImageIcon} size={20} color="muted-foreground" />
        </View>
      ) : null}
    </View>
  );
}

export const CardArtImage = memo(
  CardArtImageInner,
  (prev, next) =>
    prev.uri === next.uri &&
    prev.recyclingKey === next.recyclingKey &&
    prev.contentFit === next.contentFit &&
    prev.contentPosition === next.contentPosition &&
    prev.instant === next.instant &&
    prev.thumbWidth === next.thumbWidth &&
    prev.progressive === next.progressive &&
    prev.className === next.className &&
    prev.imageClassName === next.imageClassName
);
