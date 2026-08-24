import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useSearchScreenBody } from '@/hooks/useSearchScreenBody';

export default function SearchScreen() {
  return (
    <ScreenLayout mode="flex" contentClassName="flex-1">
      <SearchScreenBody />
    </ScreenLayout>
  );
}

function SearchScreenBody() {
  return useSearchScreenBody();
}
