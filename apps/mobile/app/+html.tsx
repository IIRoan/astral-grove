import { ScrollViewStyleReset } from 'expo-router/html';
import {
  WEB_FONT_FACE_STYLE_ID,
  getWebFontFaceCss,
  getWebFontPreloadHrefs,
} from '@/lib/web-font-faces';

// Web-only root HTML for static rendering — runs in Node, not the DOM.
export default function Root({ children }: { children: React.ReactNode }) {
  const fontCss = getWebFontFaceCss();
  const fontHrefs = getWebFontPreloadHrefs();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Disable body scrolling so ScrollView behaves like native. */}
        <ScrollViewStyleReset />

        {fontHrefs.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/ttf"
            crossOrigin="anonymous"
          />
        ))}

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {fontCss ? (
          <style
            id={WEB_FONT_FACE_STYLE_ID}
            dangerouslySetInnerHTML={{ __html: fontCss }}
          />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
html,
body {
  height: 100%;
  /* auto — forced grayscale AA thins light-on-dark in Firefox/Zen vs Chrome */
  -webkit-font-smoothing: auto;
  -moz-osx-font-smoothing: auto;
  text-rendering: optimizeLegibility;
  font-synthesis: none;
  font-synthesis-weight: none;
  font-synthesis-style: none;
}

*,
*::before,
*::after {
  font-synthesis: none;
  font-synthesis-weight: none;
}

svg {
  shape-rendering: geometricPrecision;
  text-rendering: geometricPrecision;
  overflow: visible;
}

@supports (-moz-appearance: none) {
  strong,
  b {
    font-weight: 700;
  }
}

/* No env(safe-area-inset-*) padding here: react-native-safe-area-context already
   reads those insets on web, so padding body too would double them. */
body {
  background-color: oklch(0.97 0 0);
}

body > div,
#root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100%;
  height: 100%;
}

@media (prefers-color-scheme: dark) {
  body {
    background-color: oklch(0.13 0 0);
  }
}

input:focus,
textarea:focus {
  outline: none;
}`;
