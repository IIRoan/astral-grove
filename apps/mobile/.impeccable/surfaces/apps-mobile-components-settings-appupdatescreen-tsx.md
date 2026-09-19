---
version: 1
slug: 'apps-mobile-components-settings-appupdatescreen-tsx'
primary_target: 'apps/mobile/components/settings/AppUpdateScreen.tsx'
related_targets:
  [
    'apps/mobile/components/settings/UpdateChannelSection.tsx',
    'apps/mobile/hooks/useAppUpdate.tsx',
    'apps/mobile/app/_layout.tsx',
    'apps/mobile/app/update.tsx',
    'apps/mobile/app/(tabs)/settings.tsx',
  ]
---

# App update dispatch

- mode: Operate
- audience: Collectors on a preview or production ad-hoc/store install
- job: Learn a newer JS bundle is waiting, install it, restart to apply — without blocking catalog work if they tap Later
- constraints: expo-updates only on standalone native builds; fingerprint must match; web and Expo start stay idle
- direction: Full-screen instrument dispatch (empty rune → fill → restart). Chalk commit. Channel kicker in Geist Mono.
- memorable: Rune fill is the download, not a spinner.
