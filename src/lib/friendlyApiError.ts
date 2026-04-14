/** Turns API/network errors into short, user-facing copy (no schema jargon). */
export function friendlyApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error == null) return fallback;
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;
  if (!raw.trim()) return fallback;
  if (
    /Could not resolve DMAID|could not resolve dma|postal code that exists/i.test(
      raw,
    )
  ) {
    return "We couldn’t match that postal code to a DMA in our list. Try a different code, or ask your administrator to add it.";
  }
  if (
    /ECONNREFUSED|Failed to fetch|NetworkError|Load failed|network request failed/i.test(
      raw,
    )
  ) {
    return "We couldn’t reach the server. Make sure it’s running and try again.";
  }
  if (
    /still referenced|Cannot delete company|referenced by other|foreign key|FK constraint/i.test(
      raw,
    )
  ) {
    return "This company can’t be removed because it’s still linked to other items. Remove or reassign those links first, or ask an administrator for help.";
  }
  if (/internal server error/i.test(raw)) {
    return 'Something unexpected happened. Please try again in a moment.';
  }
  return raw;
}
