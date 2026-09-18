import { NitroModules } from 'react-native-nitro-modules';
import type {
  CardOcrFrame,
  FrameScanOptions,
  FrameScanResult,
  ImageMatch,
} from './CardOcrFrame.nitro';

export type { CardOcrFrame, FrameScanOptions, FrameScanResult, ImageMatch };

/**
 * The frame-processor plugin. Created once at module scope so the worklet thread
 * reuses a single HybridObject rather than constructing one per frame.
 */
export const cardOcrFrame =
  NitroModules.createHybridObject<CardOcrFrame>('CardOcrFrame');
