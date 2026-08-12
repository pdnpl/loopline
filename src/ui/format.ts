/** Stopwatch formatting. Fixed width so digits do not jitter as they tick. */
export function formatTime(ms: number, decimals: 1 | 2 = 2): string {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) return seconds.toFixed(decimals);

  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(decimals).padStart(decimals + 3, '0')}`;
}
