import {
  AsYouType,
  isValidPhoneNumber,
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
      return { country: p.country, display: a.input(p.nationalNumber) };
    } catch {
      return { country: fallbackCountry, display: t };
    }
  }
  try {
    const p = parsePhoneNumber(t, fallbackCountry);
    const a = new AsYouType(p.country);
    return { country: p.country, display: a.input(p.nationalNumber) };
  } catch {
    return { country: fallbackCountry, display: t };
  }
}

/** Returns E.164 if the current input is a complete valid number, otherwise empty string. */
export function tryE164FromDisplay(
  display: string,
  country: PhoneCountrySelection,
): string {
  const t = (display || '').trim();
  if (!t) return '';
  if (!country) return '';
  const a = new AsYouType(country);
  a.input(t);
  const n = a.getNumber();
  if (!n) return '';
  const e164 = n.format('E.164');
  return isValidPhoneNumber(e164) ? e164 : '';
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
