import { describe, expect, mock, test } from 'bun:test';
import { withDevelopmentMetadata } from './upload-development-build.cjs';

const settings = {
  projectId: '84e78cd9-68b6-4642-964f-2212b036d515',
  appIdentifier: 'com.iroan.astralgrove.dev',
  commit: 'a'.repeat(40),
  sourceRef: 'card-scanner',
};
const metadata = {
  appIdentifier: settings.appIdentifier,
  developmentClient: true,
  fingerprintHash: 'reference-hash',
};
const build = {
  id: 'uploaded-build',
  buildProfile: 'development',
  updateChannel: { name: 'development' },
  gitCommitHash: settings.commit,
};

describe('development upload metadata', () => {
  test('adds labels at creation and preserves archive metadata and authentication', async () => {
    const create = mock(async () => build);
    const upload = withDevelopmentMetadata(create, settings);
    const client = { authenticated: true };
    const source = { type: 'GCS', bucketKey: 'archive' };
    expect(
      await upload(client, settings.projectId, { platform: 'IOS' }, source, metadata)
    ).toEqual(build);
    expect(create).toHaveBeenCalledWith(
      client,
      settings.projectId,
      { platform: 'IOS' },
      source,
      {
        ...metadata,
        buildProfile: 'development',
        channel: 'development',
        environment: 'development',
        distribution: 'INTERNAL',
        gitCommitHash: settings.commit,
        message: 'iOS development (card-scanner)',
      }
    );
  });

  test.each([
    { ...metadata, appIdentifier: 'com.iroan.astralgrove' },
    { ...metadata, developmentClient: false },
  ])('rejects a non-development app before creating a build', async (appMetadata) => {
    const create = mock(async () => build);
    await expect(
      withDevelopmentMetadata(create, settings)(
        null,
        settings.projectId,
        { platform: 'IOS' },
        {},
        appMetadata
      )
    ).rejects.toThrow('Refusing');
    expect(create).not.toHaveBeenCalled();
  });

  test('rejects another project', async () => {
    const create = mock(async () => build);
    await expect(
      withDevelopmentMetadata(create, settings)(
        null,
        'another-project',
        { platform: 'IOS' },
        {},
        metadata
      )
    ).rejects.toThrow('Refusing');
    expect(create).not.toHaveBeenCalled();
  });

  test('fails when EAS returns missing labels', async () => {
    const upload = withDevelopmentMetadata(
      async () => ({ ...build, updateChannel: null }),
      settings
    );
    await expect(
      upload(null, settings.projectId, { platform: 'IOS' }, {}, metadata)
    ).rejects.toThrow('did not retain');
  });
});
