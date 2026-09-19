import { View } from 'react-native';

/** Leading list/scroll spacer — avoids dynamic `contentContainerStyle.paddingTop`. */
export function ListTopSpacer({ height }: { height: number }) {
  if (height <= 0) return null;
  return <View style={{ height }} collapsable={false} />;
}
