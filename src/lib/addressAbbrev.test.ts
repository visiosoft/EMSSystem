import { describe, expect, it } from 'vitest';
import {
  toCountryAlpha2FromDisplayString,
  toStateProvinceAbbrevForDisplay,
} from './addressAbbrev';

describe('toCountryAlpha2FromDisplayString', () => {
  it('normalizes to ISO-3166-1 alpha-2', () => {
    expect(toCountryAlpha2FromDisplayString('United States')).toBe('US');
    expect(toCountryAlpha2FromDisplayString('USA')).toBe('US');
    expect(toCountryAlpha2FromDisplayString('us')).toBe('US');
    expect(toCountryAlpha2FromDisplayString('Canada')).toBe('CA');
  });
});

describe('toStateProvinceAbbrevForDisplay', () => {
  it('maps US and CA full names to codes', () => {
    expect(toStateProvinceAbbrevForDisplay('Pennsylvania', 'US')).toBe('PA');
    expect(toStateProvinceAbbrevForDisplay('ON', 'CA')).toBe('ON');
  });

  it('maps Jordan governorates to ISO 3166-2:JO subdivision codes (e.g. JO-AM → AM)', () => {
    expect(toStateProvinceAbbrevForDisplay('Amman Governorate', 'JO')).toBe('AM');
  });
});
