const { dirname, join, sep } = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');

const uniwindConfig = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});

// Bun: Uniwind's react-native remap can recurse (multi-hash uniwind folders); resolve RN from Expo when originating inside uniwind.
const UNIWIND_PKG = `${sep}node_modules${sep}uniwind${sep}`;
const expoResolveRequest = config.resolver?.resolveRequest;
const uniwindResolveRequest = uniwindConfig.resolver.resolveRequest;

// three's CommonJS entry calls process.emitWarning, which React Native lacks; serve the ESM build to `require('three')` callers too (@react-three/fiber).
const THREE_ESM = join(dirname(require.resolve('three')), 'three.module.js');

uniwindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: THREE_ESM };
  const fromUniwind = context.originModulePath.includes(UNIWIND_PKG);
  if (
    fromUniwind &&
    (moduleName === 'react-native' || moduleName.startsWith('react-native/'))
  ) {
    const base = expoResolveRequest ?? context.resolveRequest;
    return base(context, moduleName, platform);
  }
  return uniwindResolveRequest(context, moduleName, platform);
};

module.exports = uniwindConfig;
