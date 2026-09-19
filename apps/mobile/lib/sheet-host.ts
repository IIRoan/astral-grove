type SheetCloser = () => void;

type ActiveSheet = {
  token: number;
  close: SheetCloser;
};

let active: ActiveSheet | null = null;
let nextToken = 0;

/** Close any other open sheet/drawer, then own the shared host. */
export function claimSheetHost(close: SheetCloser): number {
  const token = ++nextToken;
  const previous = active;
  active = { token, close };
  if (previous) {
    previous.close();
  }
  return token;
}

export function releaseSheetHost(token: number): void {
  if (active?.token === token) {
    active = null;
  }
}

export function resetSheetHostForTests(): void {
  active = null;
  nextToken = 0;
}
