/**
 * Company address: country as ISO-3166-1 alpha-2, state/province as the shortest
 * standard code we can resolve (US/CA from known names, else Google / stored value).
 */
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

let enRegistered = false;
function ensureEnLocale() {
  if (enRegistered) return;
  countries.registerLocale(enLocale);
  enRegistered = true;
}

const US_NAME_TO_CODE: Readonly<Record<string, string>> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE',
  nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX',
  utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'puerto rico': 'PR',
};

const CA_NAME_TO_CODE: Readonly<Record<string, string>> = {
  alberta: 'AB',
  'british columbia': 'BC',
  manitoba: 'MB',
  'new brunswick': 'NB',
  'newfoundland and labrador': 'NL',
  'northwest territories': 'NT',
  'nova scotia': 'NS',
  nunavut: 'NU',
  ontario: 'ON',
  'prince edward island': 'PE',
  quebec: 'QC',
  québec: 'QC',
  saskatchewan: 'SK',
  yukon: 'YT',
};

const US_CODE = new Set(Object.values(US_NAME_TO_CODE));
const CA_CODE = new Set(Object.values(CA_NAME_TO_CODE));

/**
 * ISO 3166-2:JO (Jordan governorates) — 2nd segment only for display with country=JO
 * e.g. JO-AM → "AM" (Al ‘Aşimah / Amman). Ref: https://en.wikipedia.org/wiki/ISO_3166-2:JO
 */
const JO_NAME_TO_CODE: Readonly<Record<string, string>> = {
  'amman governorate': 'AM',
  "al 'aşimah": 'AM',
  "al 'asimah": 'AM',
  'al \u2018aşimah': 'AM',
  'capital governorate': 'AM',
  amman: 'AM',
  "ajloun governorate": 'AJ',
  ajloun: 'AJ',
  ajlun: 'AJ',
  "al 'aqabah": 'AQ',
  'al aqabah': 'AQ',
  'aqaba governorate': 'AQ',
  aqaba: 'AQ',
  "al balqā'": 'BA',
  "al balqa'": 'BA',
  albalqa: 'BA',
  'balqa governorate': 'BA',
  'balqa': 'BA',
  "al karak": 'KA',
  'al karak governorate': 'KA',
  'karak governorate': 'KA',
  karak: 'KA',
  "al mafraq": 'MA',
  mafraq: 'MA',
  'mafraq governorate': 'MA',
  "aţ ţafīlah": 'AT',
  'tafilah governorate': 'AT',
  tafilah: 'AT',
  tafiela: 'AT',
  "az zarqā'": 'AZ',
  'az zarqa': 'AZ',
  'zarqa governorate': 'AZ',
  zarqa: 'AZ',
  irbid: 'IR',
  'irbid governorate': 'IR',
  'jarash governorate': 'JA',
  jarash: 'JA',
  jerash: 'JA',
  "ma\u2018an": 'MN',
  "ma'an": 'MN',
  maan: 'MN',
  "ma'an governorate": 'MN',
  "madaba governorate": 'MD',
  madaba: 'MD',
};

const JO_CODE = new Set<string>(['AJ', 'AQ', 'AM', 'BA', 'KA', 'MA', 'AT', 'AZ', 'IR', 'JA', 'MN', 'MD']);

/** Google country component: always prefer 2-letter short_name, else resolve long name. */
export function toCountryAlpha2FromGoogleComponents(
  longName?: string,
  shortName?: string,
): string | undefined {
  const s = shortName?.trim();
  if (s && /^[A-Za-z]{2}$/u.test(s)) {
    return s.toUpperCase();
  }
  const t = (longName || s || '').trim();
  if (!t) return undefined;
  return toCountryAlpha2FromDisplayString(t) || undefined;
}

/** API / form value → ISO-3166-1 alpha-2. */
export function toCountryAlpha2FromDisplayString(value: string | undefined | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  ensureEnLocale();

  if (/^[A-Za-z]{2}$/u.test(raw)) {
    if (countries.isValid(raw)) return raw.toUpperCase();
  }
  if (/^[A-Za-z]{3}$/u.test(raw)) {
    const a2 = countries.toAlpha2(raw);
    if (a2) return a2;
  }
  const lower = raw.toLowerCase();
  if (lower === 'usa' || lower === 'u.s.a' || lower === 'u.s.a' || lower === 'u.s.') {
    return 'US';
  }
  if (lower === 'u.k' || lower === 'uk' || lower === 'u.k.') return 'GB';

  const fromName = countries.getAlpha2Code(raw, 'en');
  if (fromName) return fromName;

  const compact = lower.replace(/,/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim();
  const fromCompact = countries.getAlpha2Code(compact, 'en') ?? countries.getSimpleAlpha2Code(raw, 'en');
  if (fromCompact) return fromCompact;

  if (/^[A-Za-z]{2}$/u.test(raw)) return raw.toUpperCase();
  return raw;
}

/**
 * State/province: abbreviate for US/Canada when we recognize the full name;
 * else keep a short token from Google, or the stored string.
 * `countryAlpha2` is ISO-2 (e.g. US, CA, JO) when known; may be `""` for legacy rows.
 */
export function toStateProvinceAbbrevForDisplay(
  value: string | undefined | null,
  countryAlpha2: string | undefined | null,
): string {
  const s = (value || '').trim();
  if (!s) return '';
  const countryNorm = toCountryAlpha2FromDisplayString(
    (countryAlpha2 || '').trim(),
  );
  const cc = countryNorm || (countryAlpha2 || '').trim().toUpperCase();

  const usLocal = () => {
    const n = s.toLowerCase();
    if (n.length === 2 && US_CODE.has(s.toUpperCase())) {
      return s.toUpperCase();
    }
    return US_NAME_TO_CODE[n] || '';
  };
  const caLocal = () => {
    const n = s.toLowerCase();
    if (n.length === 2 && CA_CODE.has(s.toUpperCase())) {
      return s.toUpperCase();
    }
    return CA_NAME_TO_CODE[n] || '';
  };
  const joLocal = () => {
    const n0 = s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (n0.length === 2 && JO_CODE.has(s.toUpperCase())) {
      return s.toUpperCase();
    }
    if (JO_NAME_TO_CODE[n0]) {
      return JO_NAME_TO_CODE[n0]!;
    }
    const nStripped = n0.replace(/\s+governorate$/i, '').replace(/\s+muhafazah$/i, '').trim();
    if (nStripped !== n0) {
      if (JO_NAME_TO_CODE[nStripped]) return JO_NAME_TO_CODE[nStripped]!;
    }
    if (nStripped.length === 2 && JO_CODE.has(nStripped.toUpperCase())) {
      return nStripped.toUpperCase();
    }
    return '';
  };

  if (cc === 'US') {
    return usLocal() || s;
  }
  if (cc === 'CA') {
    return caLocal() || s;
  }
  if (cc === 'JO') {
    return joLocal() || s;
  }
  if (!cc) {
    return usLocal() || caLocal() || joLocal() || s;
  }
  if (s.length >= 1 && s.length <= 3 && /^[A-Za-z0-9-]+$/u.test(s)) {
    return s.toUpperCase();
  }
  return s;
}
