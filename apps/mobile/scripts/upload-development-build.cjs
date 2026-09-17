const { realpathSync } = require('node:fs');
const { createRequire } = require('node:module');
const { z } = require('zod');

const CLI_VERSION = '24.6.0';

function withDevelopmentMetadata(
  createBuild,
  { projectId, appIdentifier, commit, sourceRef }
) {
  z.string().uuid().parse(projectId);
  z.string()
    .regex(/^[a-f0-9]{40}$/)
    .parse(commit);
  return async (client, appId, job, artifactSource, metadata) => {
    if (
      appId !== projectId ||
      job.platform !== 'IOS' ||
      job.simulator ||
      metadata?.appIdentifier !== appIdentifier ||
      metadata?.developmentClient !== true
    ) {
      throw new Error(
        'Refusing to label an unrelated build as an iOS development client'
      );
    }
    const build = await createBuild(client, appId, job, artifactSource, {
      ...metadata,
      buildProfile: 'development',
      channel: 'development',
      environment: 'development',
      distribution: 'INTERNAL',
      gitCommitHash: commit,
      message: `iOS development (${sourceRef})`,
    });
    if (
      build.buildProfile !== 'development' ||
      build.updateChannel?.name !== 'development' ||
      build.gitCommitHash !== commit
    ) {
      throw new Error(`EAS build ${build.id} did not retain the development metadata`);
    }
    return build;
  };
}

module.exports = { withDevelopmentMetadata };

if (require.main === module) {
  const [, , cliPath, ...args] = process.argv;
  if (!cliPath) throw new Error('Pass the installed eas executable path');
  const cli = realpathSync(cliPath);
  const cliRequire = createRequire(cli);
  if (cliRequire('../package.json').version !== CLI_VERSION) {
    throw new Error(`Development upload adapter requires eas-cli ${CLI_VERSION}`);
  }
  const app = require('../app.json').expo;
  const profile = require('../eas.json').build.development;
  if (
    !profile.developmentClient ||
    profile.channel !== 'development' ||
    profile.environment !== 'development'
  ) {
    throw new Error(
      'The development build profile must use the development channel and environment'
    );
  }
  // eas upload omits these fields; metadata updates failed for our existing local upload.
  const { LocalBuildMutation } = cliRequire(
    '../build/graphql/mutations/LocalBuildMutation'
  );
  if (typeof LocalBuildMutation.createLocalBuildAsync !== 'function') {
    throw new Error(
      'EAS upload internals changed; update the development upload adapter'
    );
  }
  LocalBuildMutation.createLocalBuildAsync = withDevelopmentMetadata(
    LocalBuildMutation.createLocalBuildAsync,
    {
      projectId: app.extra.eas.projectId,
      appIdentifier: `${app.ios.bundleIdentifier}.dev`,
      commit: process.env.GITHUB_SHA ?? '',
      sourceRef: process.env.EAS_BUILD_SOURCE_REF ?? 'unknown',
    }
  );
  process.argv = [process.execPath, cli, 'upload', ...args];
  require(cli);
}
