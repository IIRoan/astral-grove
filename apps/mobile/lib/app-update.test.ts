import { describe, expect, test } from 'bun:test';
import {
  formatChannelLabel,
  formatDownloadPercent,
  formatUpdateId,
  resolveAppUpdateAction,
  resolveAppUpdatePhase,
  toastCopyForUpdateCheck,
  type AppUpdateSnapshot,
} from '@/lib/app-update';

const base: AppUpdateSnapshot = {
  enabled: true,
  isRestarting: false,
  isDownloading: false,
  isUpdatePending: false,
  isUpdateAvailable: false,
  downloadError: false,
  dismissed: false,
};

describe('resolveAppUpdatePhase', () => {
  test('stays idle when updates are disabled', () => {
    expect(
      resolveAppUpdatePhase({ ...base, enabled: false, isUpdateAvailable: true })
    ).toBe('idle');
  });

  test('shows available when a newer bundle is on the channel', () => {
    expect(resolveAppUpdatePhase({ ...base, isUpdateAvailable: true })).toBe(
      'available'
    );
  });

  test('hides available after Later', () => {
    expect(
      resolveAppUpdatePhase({ ...base, isUpdateAvailable: true, dismissed: true })
    ).toBe('idle');
  });

  test('download stays visible; Later hides ready until the next launch', () => {
    expect(
      resolveAppUpdatePhase({
        ...base,
        isUpdateAvailable: true,
        isDownloading: true,
        dismissed: true,
      })
    ).toBe('downloading');
    expect(
      resolveAppUpdatePhase({
        ...base,
        isUpdatePending: true,
        dismissed: true,
      })
    ).toBe('idle');
    expect(resolveAppUpdatePhase({ ...base, isUpdatePending: true })).toBe('ready');
  });

  test('restarting and download error take priority', () => {
    expect(
      resolveAppUpdatePhase({ ...base, isRestarting: true, isDownloading: true })
    ).toBe('restarting');
    expect(
      resolveAppUpdatePhase({ ...base, downloadError: true, isUpdateAvailable: true })
    ).toBe('error');
  });

  test('Later closes a failed download instead of trapping the modal', () => {
    expect(
      resolveAppUpdatePhase({ ...base, downloadError: true, dismissed: true })
    ).toBe('idle');
  });
});

describe('resolveAppUpdateAction', () => {
  test('keeps install and restart after Later so Settings can finish this session', () => {
    expect(
      resolveAppUpdateAction({ ...base, isUpdateAvailable: true, dismissed: true })
    ).toBe('available');
    expect(
      resolveAppUpdateAction({ ...base, isUpdatePending: true, dismissed: true })
    ).toBe('ready');
    expect(
      resolveAppUpdateAction({ ...base, downloadError: true, dismissed: true })
    ).toBe('error');
  });

  test('stays idle when nothing is waiting', () => {
    expect(resolveAppUpdateAction({ ...base, dismissed: true })).toBe('idle');
  });
});

describe('update labels', () => {
  test('formats channel, id, and download percent', () => {
    expect(formatChannelLabel('preview')).toBe('PREVIEW');
    expect(formatChannelLabel(null)).toBe('MAIN');
    expect(formatUpdateId('abcdefghijklmnop')).toBe('abcdefgh…');
    expect(formatUpdateId('short')).toBe('short');
    expect(formatDownloadPercent(0.42)).toBe(42);
    expect(formatDownloadPercent(undefined)).toBe(0);
  });
});

describe('toastCopyForUpdateCheck', () => {
  test('maps check results to toaster copy', () => {
    expect(toastCopyForUpdateCheck({ status: 'disabled' })).toEqual({
      type: 'message',
      text: 'Updates are off in this build',
    });
    expect(toastCopyForUpdateCheck({ status: 'available' })).toEqual({
      type: 'success',
      text: 'Update available',
    });
    expect(toastCopyForUpdateCheck({ status: 'up-to-date' })).toEqual({
      type: 'message',
      text: 'No update available',
    });
    expect(
      toastCopyForUpdateCheck({ status: 'error', message: 'network down' })
    ).toEqual({
      type: 'error',
      text: 'network down',
    });
  });
});
