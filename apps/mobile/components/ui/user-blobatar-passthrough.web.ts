export function blobatarPlatformPassthrough(label: string) {
  return { role: 'img' as const, 'aria-label': label, title: label };
}
