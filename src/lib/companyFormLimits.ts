/**
 * Company / address field max lengths — keep in sync with
 * `backend/src/company/dto` (CreateCompanyDto, AddressFieldsDto).
 */
export const COMPANY_FORM = {
  companyName: 200,
  addressLine1: 200,
  addressLine2: 200,
  city: 100,
  stateProvince: 100,
  postalCode: 20,
  country: 100,
  /** Mailing autofill hint text (not persisted as a single DTO field). */
  googleFormattedMailingDisplay: 500,
} as const;

/** Truncate to max length (paste / programmatic text cannot exceed DTO limits). */
export function clampToMaxLen(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}
