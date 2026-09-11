const STREAM_DISCONNECT_MESSAGES = [
  'error in input stream',
  'network error',
  'failed to fetch',
  'load failed',
  'networkerror when attempting to fetch resource',
  'network request failed',
];

/** Browser/native fetch-stream drops after HTTP 200 (Firefox uses "Error in input stream"). */
export function isLiveStreamDisconnect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  if (error.name !== 'TypeError' && error.name !== 'NetworkError') return false;
  const message = error.message.toLowerCase();
  return STREAM_DISCONNECT_MESSAGES.some((fragment) => message.includes(fragment));
}
