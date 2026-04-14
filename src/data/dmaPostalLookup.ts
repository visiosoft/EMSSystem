/**
 * Prototype postal → DMA mapping (replace with API / DB later).
 * US: first 3 digits of the ZIP (5- or 9-digit input).
 * Other countries: add rows to INTERNATIONAL_POSTAL_TO_DMA (`CC|postal` or `CC|prefix`).
 */

export type PostalDmaSource = 'us_zip_prefix' | 'international_table' | 'none';

export interface PostalDmaLookupResult {
  dmaIds: string[];
  source: PostalDmaSource;
}

/** US ZIP first-three-digits → DMA id (Nielsen-style prototype). */
const US_ZIP_PREFIX_TO_DMA: Record<string, string> = {
  '070': 'dma-01', '100': 'dma-01', '101': 'dma-01', '102': 'dma-01', '103': 'dma-01', '104': 'dma-01',
  '105': 'dma-01', '106': 'dma-01', '107': 'dma-01', '108': 'dma-01', '109': 'dma-01',
  '110': 'dma-01', '111': 'dma-01', '112': 'dma-01', '113': 'dma-01', '114': 'dma-01',
  '115': 'dma-01', '116': 'dma-01', '117': 'dma-01', '118': 'dma-01', '119': 'dma-01',

  '900': 'dma-02', '901': 'dma-02', '902': 'dma-02', '903': 'dma-02', '904': 'dma-02',
  '905': 'dma-02', '906': 'dma-02', '907': 'dma-02', '908': 'dma-02', '909': 'dma-02',

  '600': 'dma-03', '601': 'dma-03', '602': 'dma-03', '603': 'dma-03', '604': 'dma-03',
  '605': 'dma-03', '606': 'dma-03', '607': 'dma-03', '608': 'dma-03', '609': 'dma-03',

  '750': 'dma-04', '751': 'dma-04', '752': 'dma-04', '753': 'dma-04', '754': 'dma-04',
  '755': 'dma-04', '756': 'dma-04', '757': 'dma-04', '758': 'dma-04', '759': 'dma-04',

  '770': 'dma-05', '771': 'dma-05', '772': 'dma-05', '773': 'dma-05', '774': 'dma-05',
  '775': 'dma-05', '776': 'dma-05', '777': 'dma-05', '778': 'dma-05', '779': 'dma-05',

  '190': 'dma-06', '191': 'dma-06', '192': 'dma-06', '193': 'dma-06', '194': 'dma-06',
  '195': 'dma-06', '196': 'dma-06', '197': 'dma-06', '198': 'dma-06', '199': 'dma-06',

  '330': 'dma-07', '331': 'dma-07', '332': 'dma-07', '333': 'dma-07', '334': 'dma-07',
  '335': 'dma-07', '336': 'dma-07', '337': 'dma-07', '338': 'dma-07', '339': 'dma-07',

  '300': 'dma-08', '301': 'dma-08', '302': 'dma-08', '303': 'dma-08', '304': 'dma-08',
  '305': 'dma-08', '306': 'dma-08', '307': 'dma-08', '308': 'dma-08', '309': 'dma-08',

  '980': 'dma-09', '981': 'dma-09', '982': 'dma-09', '983': 'dma-09', '984': 'dma-09',
  '985': 'dma-09', '986': 'dma-09', '987': 'dma-09', '988': 'dma-09', '989': 'dma-09',

  '800': 'dma-10', '801': 'dma-10', '802': 'dma-10', '803': 'dma-10', '804': 'dma-10',
  '805': 'dma-10', '806': 'dma-10', '807': 'dma-10', '808': 'dma-10', '809': 'dma-10',

  '020': 'dma-11', '021': 'dma-11', '022': 'dma-11', '023': 'dma-11', '024': 'dma-11',
  '025': 'dma-11', '026': 'dma-11', '027': 'dma-11', '028': 'dma-11', '029': 'dma-11',

  '940': 'dma-12', '941': 'dma-12', '942': 'dma-12', '943': 'dma-12', '944': 'dma-12',
  '945': 'dma-12', '946': 'dma-12', '947': 'dma-12', '948': 'dma-12', '949': 'dma-12',

  '370': 'dma-13', '371': 'dma-13', '372': 'dma-13', '373': 'dma-13', '374': 'dma-13',
  '375': 'dma-13', '376': 'dma-13', '377': 'dma-13', '378': 'dma-13', '379': 'dma-13',

  '480': 'dma-15', '481': 'dma-15', '482': 'dma-15', '483': 'dma-15', '484': 'dma-15',
  '485': 'dma-15', '486': 'dma-15', '487': 'dma-15', '488': 'dma-15', '489': 'dma-15',
};

/**
 * Exact or prefix matches for non-US postals. Keys: `CC|POSTAL` (digits only, uppercase CC).
 * Add database-backed rows here during prototype.
 */
const INTERNATIONAL_POSTAL_TO_DMA: Record<string, string> = {
  // Example: 'PK|54792': 'dma-03',
};

function normalizeCountryCode(country?: string | null): string | null {
  if (!country?.trim()) return null;
  const c = country.trim();
  if (c.length === 2) return c.toUpperCase();
  const lower = c.toLowerCase();
  if (lower === 'usa' || lower === 'united states' || lower === 'united states of america') return 'US';
  if (lower === 'pakistan') return 'PK';
  if (lower === 'canada') return 'CA';
  return null;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function isLikelyUsZip(postalDigits: string): boolean {
  return postalDigits.length >= 5 && postalDigits.length <= 9;
}

export function lookupDmasForPostal(postalCode: string, country?: string | null): PostalDmaLookupResult {
  const raw = postalCode?.trim() || '';
  if (raw.length < 3) {
    return { dmaIds: [], source: 'none' };
  }

  const digits = digitsOnly(raw);
  const cc = normalizeCountryCode(country ?? undefined);

  if (cc === 'US' || (!cc && isLikelyUsZip(digits))) {
    if (digits.length < 3) return { dmaIds: [], source: 'none' };
    const prefix = digits.slice(0, 3);
    const id = US_ZIP_PREFIX_TO_DMA[prefix];
    return id ? { dmaIds: [id], source: 'us_zip_prefix' } : { dmaIds: [], source: 'none' };
  }

  if (!cc) {
    return { dmaIds: [], source: 'none' };
  }

  const fullKey = `${cc}|${digits}`;
  if (INTERNATIONAL_POSTAL_TO_DMA[fullKey]) {
    return { dmaIds: [INTERNATIONAL_POSTAL_TO_DMA[fullKey]], source: 'international_table' };
  }

  if (digits.length >= 3) {
    for (let len = Math.min(6, digits.length); len >= 3; len--) {
      const prefix = digits.slice(0, len);
      const k = `${cc}|${prefix}`;
      if (INTERNATIONAL_POSTAL_TO_DMA[k]) {
        return { dmaIds: [INTERNATIONAL_POSTAL_TO_DMA[k]], source: 'international_table' };
      }
    }
  }

  return { dmaIds: [], source: 'none' };
}

export function getDmaFromPostalCode(postalCode: string, country?: string | null): string | null {
  const { dmaIds } = lookupDmasForPostal(postalCode, country);
  return dmaIds[0] ?? null;
}
