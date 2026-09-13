import { CollectionSetMissingScreen } from '@/components/collection/CollectionSetMissingScreen';
import { ScreenLayout } from '@/components/shell/ScreenLayout';

export default function CollectionSetMissingRoute() {
  return (
    <ScreenLayout mode="flex" contentClassName="flex-1">
      <CollectionSetMissingScreen />
    </ScreenLayout>
  );
}
