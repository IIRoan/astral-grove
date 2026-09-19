import { describe, expect, test, beforeEach } from 'bun:test';
import {
  claimSheetHost,
  releaseSheetHost,
  resetSheetHostForTests,
} from '@/lib/sheet-host';

describe('sheet host', () => {
  beforeEach(() => {
    resetSheetHostForTests();
  });

  test('claiming a second host closes the first', () => {
    let firstClosed = 0;
    let secondClosed = 0;
    claimSheetHost(() => {
      firstClosed += 1;
    });
    claimSheetHost(() => {
      secondClosed += 1;
    });

    expect(firstClosed).toBe(1);
    expect(secondClosed).toBe(0);

    claimSheetHost(() => undefined);
    expect(secondClosed).toBe(1);
  });

  test('releasing an old token does not clear a newer claim', () => {
    let closed = 0;
    const first = claimSheetHost(() => {
      closed += 1;
    });
    claimSheetHost(() => undefined);
    releaseSheetHost(first);
    expect(closed).toBe(1);

    let kept = true;
    const third = claimSheetHost(() => {
      kept = false;
    });
    releaseSheetHost(first);
    expect(kept).toBe(true);
    releaseSheetHost(third);
  });
});
