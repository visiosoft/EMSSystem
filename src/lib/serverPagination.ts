/**
 * Uniform server-backed pagination: every page requests the same `limit`
 * and the UI shows a user-selectable number of rows per page.
 */

export const PAGE_SIZE = 25;

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 500] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

/** @deprecated Use {@link PAGE_SIZE} */
export const FIRST_PAGE_SIZE = PAGE_SIZE;
/** @deprecated Use {@link PAGE_SIZE} */
export const SUBSEQUENT_PAGE_SIZE = PAGE_SIZE;

/** Coerce a number to a supported page size (default 25). */
export function toPageSize(n: number): PageSizeOption {
  const v = Math.floor(Number(n)) || PAGE_SIZE;
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(v)) {
    return v as PageSizeOption;
  }
  return PAGE_SIZE;
}

/** Returns `{ offset, limit }` for a 1-based page index. */
export function getPageParams(
  page: number,
  pageSize: number = PAGE_SIZE,
): { offset: number; limit: number } {
  const limit = toPageSize(pageSize);
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  return { offset: (p - 1) * limit, limit };
}

/** Total pages for a row count and page size. */
export function getTotalPages(total: number, pageSize: number = PAGE_SIZE): number {
  const limit = toPageSize(pageSize);
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / limit));
}

/** 1-based inclusive range labels for the footer (“Showing a–b of c”). */
export function getPageRange(
  page: number,
  total: number,
  pageSize: number = PAGE_SIZE,
): { rangeStart: number; rangeEnd: number } {
  if (total === 0) return { rangeStart: 0, rangeEnd: 0 };
  const { offset, limit } = getPageParams(page, pageSize);
  return {
    rangeStart: offset + 1,
    rangeEnd: Math.min(offset + limit, total),
  };
}
