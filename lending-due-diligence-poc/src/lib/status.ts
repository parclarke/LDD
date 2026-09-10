/** Maps a case status onto the prototype's `.st` modifier class. */
export function statusClass(status?: string | null): string {
  const s = (status ?? '').toLowerCase();
  if (s.includes('resolved') || s.includes('completed')) return 'resolved';
  if (s.includes('reject')) return 'rejected';
  if (s === 'new' || s === '') return '';
  return 'progress';
}
