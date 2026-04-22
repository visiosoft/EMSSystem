/**
 * Uniform server-backed pagination: every page requests the same `limit`
 * and the UI shows the same number of rows (Companies, Attraction-Tours, etc.).
 */

export const PAGE_SIZE = 25;

/** @deprecated Use {@link PAGE_SIZE} */
export const FIRST_PAGE_SIZE = PAGE_SIZE;
/** @deprecated Use {@link PAGE_SIZE} */
export const SUBSEQUENT_PAGE_SIZE = PAGE_SIZE;

/** Returns `{ offset, limit }` for a 1-based page index. */
export function getPageParams(page: number): { offset: number; limit: number } {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  return { offset: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE };
}

/** Total pages for a row count and {@link PAGE_SIZE}. */
export function getTotalPages(total: number): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** 1-based inclusive range labels for the footer (“Showing a–b of c”). */
export function getPageRange(
  page: number,
  total: number,
): { rangeStart: number; rangeEnd: number } {
  if (total === 0) return { rangeStart: 0, rangeEnd: 0 };
  const { offset, limit } = getPageParams(page);
  return {
    rangeStart: offset + 1,
    rangeEnd: Math.min(offset + limit, total),
  };
}
