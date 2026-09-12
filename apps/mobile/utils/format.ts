export const exactAge = (timestamp: number | undefined, now = Date.now()) => {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return 'unavailable';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return Math.floor(seconds / 3600) + 'h ' + Math.floor(seconds % 3600 / 60) + 'm ' + seconds % 60 + 's ago';
};
export const relativeTime = (value: string | null | undefined) => exactAge(value ? Date.parse(value) : undefined);
export const statusLabel = (state: string | undefined) => state ? state[0] + state.slice(1).toLowerCase() : 'Unknown';
