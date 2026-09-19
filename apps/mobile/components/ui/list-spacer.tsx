import { View } from 'react-native';

/** List/scroll spacer — avoids dynamic `contentContainerStyle` padding. */
export function ListSpacer({ height }: { height: number }) {
  if (height <= 0) return null;
  return <View style={{ height }} collapsable={false} />;
}
