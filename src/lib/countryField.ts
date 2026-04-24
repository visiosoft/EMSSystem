import { COMPANY_FORM } from './companyFormLimits';

/**
 * Country / region names: letters (any script) and common punctuation, no digits
 * or symbols like @#%. Keep in sync with backend `address-fields.dto.ts` (@Matches).
 */
export const COUNTRY_NAME_PATTERN = /^[\p{L}\p{M}\s\-'.,]+$/u;

const COUNTRY_MAX = COMPANY_FORM.country;

export function sanitizeCountryInput(
  value: string,
  maxLen: number = COUNTRY_MAX,
): string {
  return value.replace(/[^\p{L}\p{M}\s\-'.,]/gu, '').slice(0, maxLen);
}

export function isValidCountryName(value: string): boolean {
  const t = value.trim();
  return (
    t.length > 0 &&
    t.length <= COUNTRY_MAX &&
    COUNTRY_NAME_PATTERN.test(t)
  );
}

export const COUNTRY_NAME_FORMAT_USER_MESSAGE =
  'Use letters only, with optional spaces, hyphens, apostrophes, commas, or periods (no numbers or other symbols).';
