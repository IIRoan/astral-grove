const appJson = require('./app.json');

const variant = process.env.APP_VARIANT ?? 'production';
const isDev = variant === 'development';

const expo = appJson.expo;

const splashImage = isDev
  ? './assets/images/splash-icon-dev.png'
  : './assets/images/splash-icon.png';

const plugins = (expo.plugins ?? []).map((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
    return ['expo-splash-screen', { ...plugin[1], image: splashImage }];
  }
  return plugin;
});

module.exports = {
  expo: {
    ...expo,
    name: isDev ? 'Astral Grove Dev' : expo.name,
    scheme: isDev ? 'astral-grove-dev' : expo.scheme,
    icon: isDev ? './assets/images/icon-dev.png' : expo.icon,
    plugins,
    ios: {
      ...expo.ios,
      bundleIdentifier: isDev
        ? `${expo.ios.bundleIdentifier}.dev`
        : expo.ios.bundleIdentifier,
    },
    android: {
      ...expo.android,
      package: isDev ? `${expo.android.package}.dev` : expo.android.package,
      adaptiveIcon: {
        ...expo.android.adaptiveIcon,
        foregroundImage: isDev
          ? './assets/images/adaptive-icon-dev.png'
          : expo.android.adaptiveIcon.foregroundImage,
      },
    },
    web: {
      ...expo.web,
      favicon: isDev ? './assets/images/favicon-dev.png' : expo.web.favicon,
    },
    extra: {
      ...expo.extra,
      appVariant: variant,
    },
  },
};
