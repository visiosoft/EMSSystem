import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Searchable options for phone country / area code (E.164).
 * USA and Canada (+1) first, then other NANP +1 regions, then remaining countries A–Z.
 */
export const PHONE_COUNTRY_SELECT_OPTIONS: { value: string; label: string }[] = (() => {
  const all = getCountries().map((c) => ({
    value: c,
    code: getCountryCallingCode(c),
    label: `+${getCountryCallingCode(c)} — ${regionNames.of(c) ?? c}`,
  }));
  const priority: CountryCode[] = ['US', 'CA'];
  const top = priority
    .map((code) => all.find((o) => o.value === code))
    .filter((o): o is (typeof all)[number] => o != null);
  const topValues = new Set(top.map((o) => o.value));
  const otherDial1 = all
    .filter((o) => o.code === '1' && !topValues.has(o.value))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  const rest = all
    .filter((o) => o.code !== '1')
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  return [...top, ...otherDial1, ...rest].map(({ value, label }) => ({ value, label }));
})();

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'US';
