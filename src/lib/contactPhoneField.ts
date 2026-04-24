import {
  AsYouType,
  parsePhoneNumber,
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js';
import { DEFAULT_PHONE_COUNTRY } from './contactPhoneOptions';

export const PHONE_INVALID_MESSAGE =
  'Enter a valid phone number with country code, or leave the field empty.';

/** Country not chosen yet (e.g. new contact form). */
export type PhoneCountrySelection = CountryCode | '';

/**
 * Parse stored value (E.164, or legacy national) into country + AsYouType display string.
 * @param options.noCountryWhenEmpty — if true and `raw` is empty, return `country: ''` (no default).
 */
export function parsePhoneFieldValue(
  raw: string | undefined | null,
  fallbackCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
  options?: { noCountryWhenEmpty?: boolean },
): { country: PhoneCountrySelection; display: string } {
  const t = (raw ?? '').trim();
  if (!t) {
    if (options?.noCountryWhenEmpty) {
      return { country: '', display: '' };
    }
    return { country: fallbackCountry, display: '' };
  }
  if (t.startsWith('+')) {
    try {
      const p = parsePhoneNumber(t);
      const a = new AsYouType(p.country);
      const nat = String(p.nationalNumber ?? '');
      return { country: p.country, display: a.input(nat) };
    } catch {
      return { country: fallbackCountry, display: t };
    }
  }
  try {
    const p = parsePhoneNumber(t, fallbackCountry);
    const a = new AsYouType(p.country);
    return {
      country: p.country,
      display: a.input(String(p.nationalNumber ?? '')),
    };
  } catch {
    return { country: fallbackCountry, display: t };
  }
}

/**
 * Returns E.164 from the selected country + national input.
 * Uses national digits + `parsePhoneNumber(digits, country)` so we don’t rely on
 * AsYouType state over formatted/pasted strings (which can mis-parse).
 */
export function tryE164FromDisplay(
  display: string,
  country: PhoneCountrySelection,
): string {
  const digitsOnly = (display ?? '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (!country) return '';
  try {
    const p = parsePhoneNumber(digitsOnly, country as CountryCode);
    if (!p.isValid()) return '';
    return p.format('E.164');
  } catch {
    return '';
  }
}

/** Format a stored E.164 value for list/detail UI (stable international spacing). */
export function formatE164ForDisplay(
  raw: string | null | undefined,
): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  try {
    if (t.startsWith('+')) {
      return parsePhoneNumber(t).formatInternational();
    }
  } catch {
    return t;
  }
  return t;
}

function clampNationalDigitsToCountry(
  digitsOnly: string,
  country: CountryCode,
): string {
  let accepted = '';
  for (const ch of digitsOnly) {
    const next = accepted + ch;
    if (validatePhoneNumberLength(next, country) === 'TOO_LONG') break;
    accepted = next;
  }
  return accepted;
}

/**
 * Formats user-typed phone input as a national number for the selected country
 * and blocks additional digits once that country's possible max length is reached.
 */
export function formatPhoneDisplayForCountryInput(
  rawInput: string,
  country: PhoneCountrySelection,
): string {
  if (!country) return '';
  const digitsOnly = (rawInput ?? '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  const clamped = clampNationalDigitsToCountry(digitsOnly, country);
  const formatter = new AsYouType(country);
  return formatter.input(clamped);
}
