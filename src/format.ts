const relative = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('ko', { dateStyle: 'medium', timeStyle: 'short' });

export function timeAgo(date: Date, now = Date.now()): string {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (Math.abs(seconds) < 60) return '방금';
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(days, 'day');
}

export const formatDateTime = (date: Date) => absolute.format(date);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
