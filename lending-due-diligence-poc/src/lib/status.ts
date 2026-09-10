/** Maps a case status onto the prototype's `.st` modifier class. */
export function statusClass(status?: string | null): string {
  const s = (status ?? '').toLowerCase();
  if (s.includes('resolved') || s.includes('completed')) return 'resolved';
  if (s.includes('reject')) return 'rejected';
  if (s === 'new' || s === '') return '';
  return 'progress';
}

/**
 * Pega surfaces urgency as a number. Dataverse splits it: `ava_priority` holds the
 * numeric value and `ava_urgency` a Low/Medium/High label, so prefer the number and
 * fall back to the label rather than rendering NaN.
 */
export function urgencyOf(c: { ava_priority?: number | null; ava_urgency?: string | null }): string {
  if (typeof c.ava_priority === 'number' && Number.isFinite(c.ava_priority)) return c.ava_priority.toFixed(2);
  const parsed = Number(c.ava_urgency);
  if (c.ava_urgency != null && c.ava_urgency !== '' && Number.isFinite(parsed)) return parsed.toFixed(2);
  return c.ava_urgency || '—';
}
