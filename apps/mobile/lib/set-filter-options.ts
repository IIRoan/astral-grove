import { SET_DIRECTORY } from '@/constants/setDirectory';

const SPECIAL_SET_CODES = new Set(
  SET_DIRECTORY.filter((set) => set.special).map((set) => set.code)
);

export function groupSetFilterOptions<T extends { code: string }>(
  options: readonly T[]
): { mainline: T[]; special: T[] } {
  const mainline: T[] = [];
  const special: T[] = [];

  for (const option of options) {
    // New upstream expansions stay visible until the directory classifies them.
    const group = SPECIAL_SET_CODES.has(option.code.toUpperCase()) ? special : mainline;
    group.push(option);
  }

  return { mainline, special };
}
