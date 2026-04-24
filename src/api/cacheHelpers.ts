import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Shared helpers for surgical React Query cache updates across the EMS pages.
 *
 * We deliberately keep these simple and generic — the Companies / Attractions /
 * Tours pages all use the same shapes (bare `T[]` or `{ data: T[]; total }`).
 *
 * Why surgical patches instead of invalidate + refetch?
 *   Product requirement: cached lists must only re-fetch every 30 minutes, but
 *   add/update/delete must be reflected in the cache IMMEDIATELY without a
 *   full list refetch. `setQueryData` lets us splice one row while keeping
 *   `staleTime` intact; `invalidateQueries` / `refetchQueries` would undo that.
 */

type PaginatedLike<T> = { data: T[]; total: number };
type ListShape<T> = T[] | PaginatedLike<T> | undefined;

function isPaginated<T>(v: unknown): v is PaginatedLike<T> {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as { data?: unknown }).data) &&
    typeof (v as { total?: unknown }).total === 'number'
  );
}

/**
 * Insert or update an item in a cached list (array or `{data,total}`).
 * `match` decides if a given row is the one being replaced.
 * `compare` (optional) keeps the list sorted after insert.
 */
export function upsertInList<T>(
  qc: QueryClient,
  key: QueryKey,
  next: T,
  match: (row: T) => boolean,
  compare?: (a: T, b: T) => number,
): void {
  qc.setQueryData<ListShape<T>>(key, (old) => {
    if (!old) return old;

    if (Array.isArray(old)) {
      const idx = old.findIndex(match);
      if (idx >= 0) {
        const clone = old.slice();
        clone[idx] = next;
        return compare ? clone.slice().sort(compare) : clone;
      }
      const inserted = [...old, next];
      return compare ? inserted.slice().sort(compare) : inserted;
    }

    if (isPaginated<T>(old)) {
      const list = old.data;
      const idx = list.findIndex(match);
      if (idx >= 0) {
        const clone = list.slice();
        clone[idx] = next;
        return {
          ...old,
          data: compare ? clone.slice().sort(compare) : clone,
        };
      }
      const inserted = [...list, next];
      return {
        ...old,
        data: compare ? inserted.slice().sort(compare) : inserted,
        total: old.total + 1,
      };
    }

    return old;
  });
}

/**
 * Remove items matching the predicate from a cached list (array or `{data,total}`).
 */
export function removeFromList<T>(
  qc: QueryClient,
  key: QueryKey,
  match: (row: T) => boolean,
): void {
  qc.setQueryData<ListShape<T>>(key, (old) => {
    if (!old) return old;

    if (Array.isArray(old)) {
      const next = old.filter((r) => !match(r));
      return next.length === old.length ? old : next;
    }

    if (isPaginated<T>(old)) {
      const next = old.data.filter((r) => !match(r));
      if (next.length === old.data.length) return old;
      return {
        ...old,
        data: next,
        total: Math.max(0, old.total - (old.data.length - next.length)),
      };
    }

    return old;
  });
}

/**
 * Apply a transform to every row in a cached list (array or `{data,total}`).
 * Useful for propagating a rename (e.g. attraction name change) across
 * related rows (e.g. tour rows that embed `attractionName`).
 */
export function patchEachInList<T>(
  qc: QueryClient,
  key: QueryKey,
  transform: (row: T) => T,
): void {
  qc.setQueryData<ListShape<T>>(key, (old) => {
    if (!old) return old;

    if (Array.isArray(old)) {
      let changed = false;
      const next = old.map((r) => {
        const m = transform(r);
        if (m !== r) changed = true;
        return m;
      });
      return changed ? next : old;
    }

    if (isPaginated<T>(old)) {
      let changed = false;
      const next = old.data.map((r) => {
        const m = transform(r);
        if (m !== r) changed = true;
        return m;
      });
      return changed ? { ...old, data: next } : old;
    }

    return old;
  });
}

/**
 * Wipe any cached queries whose key starts with `prefix` (e.g. server-search
 * caches keyed by query string). These are naturally small, short-lived, and
 * become stale after any mutation, so we drop them outright instead of
 * patching every variant.
 */
export function removeQueriesByPrefix(qc: QueryClient, prefix: QueryKey): void {
  qc.removeQueries({ queryKey: prefix });
}
