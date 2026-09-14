import { describe, expect, test } from 'bun:test';
import {
  parseEasJsonArray,
  PreviewUpdateTargetError,
  resolvePreviewUpdateTargets,
  type EasBuildListItem,
} from '@/lib/eas-preview-update-targets';

function previewBuild(
  overrides: Partial<EasBuildListItem> & Pick<EasBuildListItem, 'id' | 'platform'>
): EasBuildListItem {
  return {
    status: 'FINISHED',
    buildProfile: 'preview',
    completedAt: '2026-09-10T17:13:41.281Z',
    createdAt: '2026-09-10T17:08:52.061Z',
    isForIosSimulator: false,
    runtime: { version: 'runtime-ios' },
    ...overrides,
  };
}

describe('parseEasJsonArray', () => {
  test('parses a JSON array after eas-cli chatter', () => {
    expect(
      parseEasJsonArray('★ eas-cli is available.\n[{"id":"1"}]\n')
    ).toEqual([{ id: '1' }]);
  });

  test('fails when stdout has no JSON array', () => {
    expect(() => parseEasJsonArray('not json')).toThrow(PreviewUpdateTargetError);
  });
});

describe('resolvePreviewUpdateTargets', () => {
  test('pins each platform to the newest finished preview device build', () => {
    expect(
      resolvePreviewUpdateTargets([
        previewBuild({
          id: 'ios-old',
          platform: 'IOS',
          completedAt: '2026-09-07T12:03:29.605Z',
          runtime: { version: 'old-ios' },
        }),
        previewBuild({
          id: 'ios-new',
          platform: 'ios',
          completedAt: '2026-09-10T17:13:41.281Z',
          runtime: { version: '426e6f68089c1a2cf73bbe7599f6463e0ec2075e' },
        }),
        previewBuild({
          id: 'android-new',
          platform: 'ANDROID',
          completedAt: '2026-09-09T10:00:00.000Z',
          runtime: { version: 'android-runtime' },
        }),
        previewBuild({
          id: 'dev-ios',
          platform: 'IOS',
          buildProfile: 'development',
          runtime: { version: 'dev' },
        }),
        previewBuild({
          id: 'errored-ios',
          platform: 'IOS',
          status: 'ERRORED',
          completedAt: '2026-09-11T00:00:00.000Z',
          runtime: { version: 'errored' },
        }),
        previewBuild({
          id: 'sim-ios',
          platform: 'IOS',
          isForIosSimulator: true,
          completedAt: '2026-09-12T00:00:00.000Z',
          runtime: { version: 'sim' },
        }),
      ])
    ).toEqual([
      {
        platform: 'ios',
        runtimeVersion: '426e6f68089c1a2cf73bbe7599f6463e0ec2075e',
        buildId: 'ios-new',
      },
      {
        platform: 'android',
        runtimeVersion: 'android-runtime',
        buildId: 'android-new',
      },
    ]);
  });

  test('publishes only platforms that have a finished preview build', () => {
    expect(
      resolvePreviewUpdateTargets([
        previewBuild({
          id: 'ios-only',
          platform: 'IOS',
          runtime: { version: 'ios-runtime' },
        }),
      ])
    ).toEqual([
      {
        platform: 'ios',
        runtimeVersion: 'ios-runtime',
        buildId: 'ios-only',
      },
    ]);
  });

  test('uses fingerprint hash when runtime.version is missing', () => {
    expect(
      resolvePreviewUpdateTargets([
        previewBuild({
          id: 'ios-fp',
          platform: 'IOS',
          runtime: null,
          fingerprint: { hash: 'fingerprint-hash' },
        }),
      ])
    ).toEqual([
      {
        platform: 'ios',
        runtimeVersion: 'fingerprint-hash',
        buildId: 'ios-fp',
      },
    ]);
  });

  test('fails when no finished preview build exists', () => {
    expect(() =>
      resolvePreviewUpdateTargets([
        previewBuild({
          id: 'main-ios',
          platform: 'IOS',
          buildProfile: 'main',
        }),
      ])
    ).toThrow('No finished preview EAS build found');
  });

  test('fails when the latest preview build has no runtime version', () => {
    expect(() =>
      resolvePreviewUpdateTargets([
        previewBuild({
          id: 'ios-empty',
          platform: 'IOS',
          runtime: { version: '  ' },
          fingerprint: { hash: '' },
        }),
      ])
    ).toThrow('missing a runtime version');
  });
});
