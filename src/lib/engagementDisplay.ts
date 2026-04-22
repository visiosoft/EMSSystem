/** Earliest performance (opening show) — list + detail. */

function isEpochPlaceholderYmd(ymd: string): boolean {
  return ymd === '1970-01-01';
}

/**
 * `YYYY-MM-DD` for display, or "—" (hides common epoch placeholder from bad data).
 */
export function formatOpeningDateSafe(iso: string | null | undefined): string {
  if (iso == null || typeof iso !== 'string') return '—';
  const ymd = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || isEpochPlaceholderYmd(ymd)) return '—';
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * 12h time from a wall string `HH:mm` / `HH:mm:ss` — no timezone / GMT in output.
 */
export function formatSqlTimeDisplay(sqlTime: string): string {
  const s = String(sqlTime).trim();
  if (!s) return '—';
  if (
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/.test(s) ||
    s.includes('GMT') ||
    s.includes('Standard Time') ||
    (s.includes('1970') && s.length > 15)
  ) {
    return '—';
  }
  const t = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!t) return '—';
  const h = Math.min(23, Math.max(0, parseInt(t[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(t[2], 10)));
  if (Number.isNaN(h) || Number.isNaN(m)) return '—';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function normalizeYmd(date: string | null | undefined): string | null {
  if (date == null || date === '') return null;
  const s = String(date).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ymd = s.slice(0, 10);
    if (isEpochPlaceholderYmd(ymd)) return null;
    return ymd;
  }
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/.test(s) || s.includes('GMT') || s.includes('Standard Time')) {
    return null;
  }
  return null;
}

function normalizeHmsFromApi(time: string | null | undefined): string | null {
  if (time == null || time === '') return null;
  const s = String(time).trim();
  if (!s) return null;
  if (
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/.test(s) ||
    s.includes('GMT') ||
    s.includes('Standard Time')
  ) {
    return null;
  }
  const t = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!t) return null;
  const h = t[1].padStart(2, '0');
  const m = t[2].padStart(2, '0');
  const sec = (t[3] ?? '00').padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

/** "Wed, May 1, 2024 · 7:30 PM" — never emits GMT / time zone name strings. */
export function formatFirstShowLine(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  const ymd = normalizeYmd(date);
  const hms = normalizeHmsFromApi(time);

  if (!ymd && !hms) return '—';
  const d = ymd ? formatOpeningDateSafe(ymd) : '—';
  const t = hms ? formatSqlTimeDisplay(hms) : '—';
  if (d === '—' && t === '—') return '—';
  if (d !== '—' && t !== '—') return `${d} · ${t}`;
  if (d !== '—') return d;
  return t;
}
