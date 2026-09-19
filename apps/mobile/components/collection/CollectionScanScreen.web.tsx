import { Redirect } from 'expo-router';

// Scanning is iOS-only; this keeps the native camera stack out of the web bundle.
export function CollectionScanScreen() {
  return <Redirect href="/collection" />;
}
