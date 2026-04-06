/** Adds N days to an ISO date string without timezone shifting. */
export function addDays(iso: string, n: number): string {
  const p = iso.split('-');
  const date = new Date(Number(p[0]), Number(p[1]!) - 1, Number(p[2]!) + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatHeaderDate(iso: string): string {
  const todayStr = todayISO();
  if (iso === todayStr) return 'Today';
  if (iso === addDays(todayStr, 1)) return 'Tomorrow';
  if (iso === addDays(todayStr, -1)) return 'Yesterday';
  const p = iso.split('-');
  return new Date(Number(p[0]), Number(p[1]!) - 1, Number(p[2]!)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
