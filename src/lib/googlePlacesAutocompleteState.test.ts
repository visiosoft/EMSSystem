import { describe, expect, it } from 'vitest';
import { parseSubdivisionCodeFromAutocompleteDescription } from './googlePlaces';

describe('parseSubdivisionCodeFromAutocompleteDescription', () => {
  it('extracts US state to match Autocomplete line (PA vs Pennsylvania in Details)', () => {
    expect(
      parseSubdivisionCodeFromAutocompleteDescription(
        'Academy of Music, South Broad Street, Philadelphia, PA, USA',
        'us',
      ),
    ).toBe('PA');
  });

  it('matches United States suffix', () => {
    expect(
      parseSubdivisionCodeFromAutocompleteDescription(
        '240 S Broad St, Philadelphia, PA, United States',
        'us',
      ),
    ).toBe('PA');
  });

  it('returns undefined when no 2-letter token before country', () => {
    expect(
      parseSubdivisionCodeFromAutocompleteDescription('Café, Amman, Jordan', 'us'),
    ).toBeUndefined();
  });

  it('extracts Canadian province code from Autocomplete line', () => {
    expect(
      parseSubdivisionCodeFromAutocompleteDescription('123 St, Toronto, ON, Canada', 'ca'),
    ).toBe('ON');
  });

  it('extracts Jordan governorate (ISO 3166-2:JO) from Autocomplete line', () => {
    expect(
      parseSubdivisionCodeFromAutocompleteDescription(
        '24 Sayed Qutob St, Amman, AM, JO',
        'jo',
      ),
    ).toBe('AM');
  });
});
