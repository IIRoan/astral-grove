import { View } from 'react-native';

/** Trailing list/scroll spacer — avoids dynamic `contentContainerStyle.paddingBottom`. */
export function ListBottomSpacer({ height }: { height: number }) {
  if (height <= 0) return null;
  return <View style={{ height }} collapsable={false} />;
}
