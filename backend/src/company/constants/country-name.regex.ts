/**
 * Must match frontend `src/lib/countryField.ts` (COUNTRY_NAME_PATTERN).
 * Used for country, city, and state/province — no digits.
 */
export const COUNTRY_NAME_REGEX = /^[\p{L}\p{M}\s\-'.,]+$/u;

export const COUNTRY_NAME_VALIDATION_MESSAGE =
  'Country may only contain letters, spaces, and - . , \' (no numbers or other symbols).';

export const CITY_FIELD_VALIDATION_MESSAGE =
  'City may only contain letters, spaces, and - . , \' (no numbers or other symbols).';

export const STATE_PROVINCE_FIELD_VALIDATION_MESSAGE =
  'State or province may only contain letters, spaces, and - . , \' (no numbers or other symbols).';
