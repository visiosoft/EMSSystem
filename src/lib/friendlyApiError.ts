/** Primary message from thrown `Error` (Nest puts user copy here). */
function apiMessage(error: unknown): string {
  if (error == null) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

/** Optional `detail` from `apiFetch` (SQL / developer text). */
function apiDetail(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'detail' in error &&
    typeof (error as { detail?: unknown }).detail === 'string'
  ) {
    return (error as { detail: string }).detail;
  }
  return '';
}

const fkLike =
  /foreign key|FOREIGN KEY|conflicted with the FOREIGN KEY|REFERENCE constraint|violates .*constraint/i;

/** Turns API/network errors into short, user-facing copy (no schema jargon). */
export function friendlyApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const msg = apiMessage(error).trim();
  const detail = apiDetail(error);
  const raw = msg || fallback;

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
  /** Company delete — explicit API copy from `CompanyService.remove` only. */
  if (
    /This company can.t be removed because it.s still linked to other records/i.test(
      raw,
    )
  ) {
    return "This company can’t be removed because it’s still linked to other items. Remove or reassign those links first, or ask an administrator for help.";
  }
  /** Project delete — explicit API copy from `ProjectService.remove`. */
  if (
    /This project can.t be removed because it.s still linked to other records/i.test(
      raw,
    )
  ) {
    return raw;
  }
  /**
   * Raw SQL / constraint text: usually only in `message` for 500s, or only in `detail`
   * when `message` is already a short API string (do not overwrite good Nest messages).
   */
  if (fkLike.test(msg)) {
    return "The server couldn’t save this because a database rule was violated (for example a missing or invalid link). Check tour, talent agent, and project fields, then try again.";
  }
  if (
    fkLike.test(detail) &&
    (!msg || /^(Bad Request|Internal Server Error|Conflict)$/i.test(msg))
  ) {
    return "The server couldn’t save this because a database rule was violated (for example a missing or invalid link). Check tour, talent agent, and project fields, then try again.";
  }
  if (/internal server error/i.test(raw)) {
    return 'Something unexpected happened. Please try again in a moment.';
  }
  return raw;
}
