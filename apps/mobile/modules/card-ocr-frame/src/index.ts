import { NitroModules } from 'react-native-nitro-modules';
import type {
  CardMatch,
  CardOcrFrame,
  FrameScanOptions,
  FrameScanResult,
} from './CardOcrFrame.nitro';

export type { CardMatch, CardOcrFrame, FrameScanOptions, FrameScanResult };

/**
 * The frame-processor plugin. Created once at module scope so the worklet thread
 * reuses a single HybridObject rather than constructing one per frame.
 */
export const cardOcrFrame =
  NitroModules.createHybridObject<CardOcrFrame>('CardOcrFrame');
