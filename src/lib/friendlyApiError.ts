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
const duplicateLike = /duplicate key|PRIMARY KEY|UNIQUE KEY|PK_/i;

/**
 * Text for toasts and inline UI. Uses the API’s `message` only — **never** `detail`
 * (SQL / driver text stays in the JSON for DevTools → Network → response only).
 */
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
  if (
    /VenueComplexMember/i.test(detail) &&
    duplicateLike.test(detail)
  ) {
    return 'This entertainment complex link already exists for the venue. Refresh and try again.';
  }
  if (
    (/database query failed/i.test(raw) && duplicateLike.test(detail)) ||
    duplicateLike.test(msg)
  ) {
    return 'This record already exists, so it could not be saved again.';
  }
  if (/database query failed/i.test(raw)) {
    return 'We couldn’t complete this save because of a database error. Please try again.';
  }
  if (/internal server error/i.test(raw)) {
    return 'Something unexpected happened. Please try again in a moment.';
  }
  if (
    /Select a Non-Resident Withholding rule before editing|Choose a withholding record for this venue before saving/i.test(
      raw,
    )
  ) {
    return 'Choose a withholding record for this venue before saving these details.';
  }
  if (
    /NonResidentWithholding #\d+ not found|That withholding record was not found/i.test(raw)
  ) {
    return 'That withholding record was not found. Check the number or ask your administrator.';
  }
  if (!msg && detail) {
    return 'We couldn’t complete this action. For technical details, open the browser Network tab and inspect the response for this request.';
  }
  return raw;
}
