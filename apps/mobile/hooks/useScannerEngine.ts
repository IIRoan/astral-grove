import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * Which camera + recognition pipeline the scanner uses. Device-local rather than part
 * of synced user settings: this exists to A/B the two engines on real hardware, not as
 * a preference worth carrying between devices.
 */
export type ScannerEngine = 'frame' | 'photo';
export type ScannerRecognitionLevel = 'accurate' | 'fast';

export const SCANNER_ENGINES: {
  value: ScannerEngine;
  label: string;
  detail: string;
}[] = [
  {
    value: 'frame',
    label: 'Vision frame processor',
    detail:
      'Apple Vision reads the camera buffer directly — no photo is taken, the preview stays continuous, and exposure meters on the card.',
  },
  {
    value: 'photo',
    label: 'Vision photo capture',
    detail:
      'Takes a still every 150ms and reads that. Simpler pipeline, but each capture briefly interrupts the preview.',
  },
];

export const SCANNER_LEVELS: {
  value: ScannerRecognitionLevel;
  label: string;
  detail: string;
}[] = [
  {
    value: 'accurate',
    label: 'Accurate',
    detail: 'Slower per pass, better on the small collector code.',
  },
  {
    value: 'fast',
    label: 'Fast',
    detail: 'Quicker passes, more misses on small print.',
  },
];

const ENGINE_KEY = 'scanner.engine';
const LEVEL_KEY = 'scanner.recognitionLevel';

const DEFAULT_ENGINE: ScannerEngine = 'frame';
const DEFAULT_LEVEL: ScannerRecognitionLevel = 'accurate';

function isEngine(value: string | null): value is ScannerEngine {
  return value === 'frame' || value === 'photo';
}

function isLevel(value: string | null): value is ScannerRecognitionLevel {
  return value === 'accurate' || value === 'fast';
}

export function useScannerEngine() {
  const [engine, setEngineState] = useState<ScannerEngine>(DEFAULT_ENGINE);
  const [level, setLevelState] = useState<ScannerRecognitionLevel>(DEFAULT_LEVEL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [storedEngine, storedLevel] = await AsyncStorage.multiGet([
          ENGINE_KEY,
          LEVEL_KEY,
        ]);
        if (cancelled) return;
        if (isEngine(storedEngine?.[1] ?? null))
          setEngineState(storedEngine![1] as ScannerEngine);
        if (isLevel(storedLevel?.[1] ?? null))
          setLevelState(storedLevel![1] as ScannerRecognitionLevel);
      } catch {
        // A missing preference just means the defaults.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setEngine = useCallback((next: ScannerEngine) => {
    setEngineState(next);
    void AsyncStorage.setItem(ENGINE_KEY, next).catch(() => undefined);
  }, []);

  const setLevel = useCallback((next: ScannerRecognitionLevel) => {
    setLevelState(next);
    void AsyncStorage.setItem(LEVEL_KEY, next).catch(() => undefined);
  }, []);

  return { engine, setEngine, level, setLevel, loaded };
}
