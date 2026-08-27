/** Formatting helpers shared across the Lending Due Diligence screens. */

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  // Dataverse "DateOnly" columns come back as YYYY-MM-DD. Parsing those with the Date
  // constructor treats them as UTC midnight, which shifts the day in western time zones,
  // so read the components straight off the string instead.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00)?Z?$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const time = d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${formatDate(value)} ${time}`;
}

/** Renders a Pega-style relative deadline, e.g. "1 hour from now" / "11 months ago". */
export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const diffMs = d.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const months = Math.round(days / 30);
  const years = Math.floor(months / 12);

  let text: string;
  if (minutes < 1) text = 'less than a minute';
  else if (minutes < 60) text = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  else if (hours < 24) text = `${hours} hour${hours === 1 ? '' : 's'}`;
  else if (days < 31) text = `${days} day${days === 1 ? '' : 's'}`;
  else if (months < 12) text = `${months} month${months === 1 ? '' : 's'}`;
  else {
    const remMonths = months % 12;
    text = `${years} year${years === 1 ? '' : 's'}${remMonths ? ` ${remMonths} month${remMonths === 1 ? '' : 's'}` : ''}`;
  }
  return past ? `${text} ago` : `${text} from now`;
}

export function isOverdue(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

export function dash(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function initials(name: string): string {
  const cleaned = name.replace(/[^A-Za-z, ]/g, '').trim();
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Adds N business days to a date, used for SLA deadlines. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) remaining -= 1;
  }
  return d;
}

/** Generates a Pega-like case identifier: BC-YYMMDDNNNNN. */
export function nextCaseId(existing: string[]): string {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const prefix = `BC-${stamp}`;
  const used = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => !Number.isNaN(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}
