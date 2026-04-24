import { COMPANY_FORM } from './companyFormLimits';

/**
 * Country, city, and state/province: letters (any script) and common punctuation, no
 * digits or symbols like @#%. Keep in sync with backend `address-fields.dto.ts` (@Matches).
 */
export const COUNTRY_NAME_PATTERN = /^[\p{L}\p{M}\s\-'.,]+$/u;

const COUNTRY_MAX = COMPANY_FORM.country;

function stripAddressNameInvalidChars(value: string, maxLen: number): string {
  return value.replace(/[^\p{L}\p{M}\s\-'.,]/gu, '').slice(0, maxLen);
}

export function sanitizeCountryInput(
  value: string,
  maxLen: number = COUNTRY_MAX,
): string {
  return stripAddressNameInvalidChars(value, maxLen);
}

/** City and state/province: same character rules as country (no digits). */
export function sanitizeCityStateInput(
  value: string,
  maxLen: number,
): string {
  return stripAddressNameInvalidChars(value, maxLen);
}

export function isValidAddressNameText(value: string, maxLen: number): boolean {
  const t = value.trim();
  return (
    t.length > 0 &&
    t.length <= maxLen &&
    COUNTRY_NAME_PATTERN.test(t)
  );
}

export function isValidCountryName(value: string): boolean {
  return isValidAddressNameText(value, COUNTRY_MAX);
}

export const COUNTRY_NAME_FORMAT_USER_MESSAGE =
  'Use letters only, with optional spaces, hyphens, apostrophes, commas, or periods (no numbers or other symbols).';
