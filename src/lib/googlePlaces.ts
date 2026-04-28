import { toCountryAlpha2FromGoogleComponents } from '@/lib/addressAbbrev';

export interface AddressParts {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Places Details: physical (visit / street) vs mailing (formatted / postal-style).
 * Google does not expose a separate "mailing" field; we derive mailing from
 * `formatted_address` (geocoded) and `post_box` in `address_components` when present.
 */
export interface PlaceDetailsResult {
  placeName?: string;
  /** Full formatted address string from Places (mailing-label style line). */
  formattedAddress?: string;
  physical: AddressParts;
  mailing: AddressParts;
}

export interface AddressPrediction {
  placeId: string;
  description: string;
}

const GOOGLE_SCRIPT_ID = 'google-maps-places-sdk';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

let googleMapsLoadPromise: Promise<void> | null = null;
let autocompleteService: any | null = null;
let geocoderService: any | null = null;
let placesDetailsService: any | null = null;

function getWindowGoogle() {
  return (window as any).google;
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

function toCountryCode(input?: string): string | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'usa' || normalized === 'united states' || normalized === 'united states of america') return 'us';
  if (normalized.length === 2) return normalized;
  return undefined;
}

function normalizeCountry(longName?: string, shortName?: string): string | undefined {
  return toCountryAlpha2FromGoogleComponents(longName, shortName);
}

function componentByType(addressComponents: any[] | undefined, type: string) {
  return addressComponents?.find((comp) => comp.types?.includes(type));
}

/**
 * `administrative_area_level_1` from Google only — `short_name` (often 2-letter or local short form);
 * if absent, `long_name`. No app-side abbrev tables; matches Places/Geocoder structured output.
 */
function stateFromAddressComponents(a1: { long_name?: string; short_name?: string } | undefined) {
  if (!a1) return undefined;
  const s = a1.short_name?.trim() || a1.long_name?.trim() || '';
  return s || undefined;
}

function isUsCountry(display: string | undefined): boolean {
  const c = (display || '').trim().toLowerCase();
  return c === 'usa' || c === 'united states' || c === 'united states of america' || c === 'us';
}

function isCanadaCountry(display: string | undefined): boolean {
  const c = (display || '').trim().toLowerCase();
  return c === 'canada' || c === 'can' || c === 'cdn' || c === 'ca';
}

function isJordanCountry(display: string | undefined): boolean {
  const c = (display || '').trim().toLowerCase();
  return c === 'jo' || c === 'jor' || c === 'jordan';
}

/**
 * Autocomplete `description` line often ends with `..., City, ST, USA` while Place Details
 * `address_components` may still use the full state name. Prefer the dropdown token when it is a 2-letter code.
 * Jordan: `..., AM, JO` or `..., AM, Jordan` (ISO 3166-2:JO subdivision before country).
 */
export function parseSubdivisionCodeFromAutocompleteDescription(
  description: string | undefined,
  country: 'us' | 'ca' | 'jo',
): string | undefined {
  const d = (description || '').trim();
  if (!d) return undefined;
  if (country === 'us') {
    const m = d.match(/, ([A-Za-z]{2}),\s*(?:USA|United States)\s*$/i);
    return m ? m[1].toUpperCase() : undefined;
  }
  if (country === 'ca') {
    const m = d.match(/, ([A-Za-z]{2}),\s*Canada\s*$/i);
    return m ? m[1].toUpperCase() : undefined;
  }
  const mj = d.match(/, ([A-Za-z]{2}),\s*(?:JO|Jordan|JOR)\s*$/i);
  return mj ? mj[1].toUpperCase() : undefined;
}

function applyAutocompleteStateHint(
  physical: AddressParts,
  mailing: AddressParts,
  autocompleteDescription: string | undefined,
): { physical: AddressParts; mailing: AddressParts } {
  const country =
    physical.country || mailing.country || '';
  let nextPhysical = physical;
  let nextMailing = mailing;

  if (isUsCountry(country)) {
    const code = parseSubdivisionCodeFromAutocompleteDescription(autocompleteDescription, 'us');
    if (code) {
      nextPhysical = { ...nextPhysical, state: code };
      nextMailing = { ...nextMailing, state: code };
    }
  } else if (isCanadaCountry(country)) {
    const code = parseSubdivisionCodeFromAutocompleteDescription(autocompleteDescription, 'ca');
    if (code) {
      nextPhysical = { ...nextPhysical, state: code };
      nextMailing = { ...nextMailing, state: code };
    }
  } else if (isJordanCountry(country)) {
    const code = parseSubdivisionCodeFromAutocompleteDescription(autocompleteDescription, 'jo');
    if (code) {
      nextPhysical = { ...nextPhysical, state: code };
      nextMailing = { ...nextMailing, state: code };
    }
  }
  return { physical: nextPhysical, mailing: nextMailing };
}

/** Structured line for the place’s street / premises (visit location). */
function extractPhysicalFromComponents(addressComponents: any[] | undefined): AddressParts {
  if (!addressComponents || !addressComponents.length) return {};

  const premise = componentByType(addressComponents, 'premise')?.long_name || '';
  const subpremise = componentByType(addressComponents, 'subpremise')?.long_name || '';
  const streetNumber = componentByType(addressComponents, 'street_number')?.long_name || '';
  const route = componentByType(addressComponents, 'route')?.long_name || '';
  const poBox = componentByType(addressComponents, 'post_box')?.long_name || '';

  const countryComp = componentByType(addressComponents, 'country');
  const country = normalizeCountry(countryComp?.long_name, countryComp?.short_name);
  const a1 = componentByType(addressComponents, 'administrative_area_level_1');
  const state = stateFromAddressComponents(a1);

  const city =
    componentByType(addressComponents, 'locality')?.long_name ||
    componentByType(addressComponents, 'postal_town')?.long_name ||
    componentByType(addressComponents, 'sublocality')?.long_name ||
    componentByType(addressComponents, 'administrative_area_level_2')?.long_name ||
    undefined;

  const postalCode = componentByType(addressComponents, 'postal_code')?.long_name || undefined;

  const streetCore = [premise, subpremise, streetNumber, route].filter(Boolean).join(' ').trim();
  const street =
    streetCore ||
    (poBox ? `P.O. Box ${poBox}` : undefined) ||
    undefined;

  return { street, city, state, postalCode, country };
}

function extractAddressParts(addressComponents: any[] | undefined): AddressParts {
  if (!addressComponents || !addressComponents.length) return {};

  const subpremise = componentByType(addressComponents, 'subpremise')?.long_name || '';
  const streetNumber = componentByType(addressComponents, 'street_number')?.long_name || '';
  const route = componentByType(addressComponents, 'route')?.long_name || '';

  const countryComp = componentByType(addressComponents, 'country');
  const country = normalizeCountry(countryComp?.long_name, countryComp?.short_name);
  const a1 = componentByType(addressComponents, 'administrative_area_level_1');
  const state = stateFromAddressComponents(a1);

  const city =
    componentByType(addressComponents, 'locality')?.long_name ||
    componentByType(addressComponents, 'postal_town')?.long_name ||
    componentByType(addressComponents, 'sublocality')?.long_name ||
    componentByType(addressComponents, 'administrative_area_level_2')?.long_name ||
    undefined;

  const postalCode = componentByType(addressComponents, 'postal_code')?.long_name || undefined;

  const street =
    [subpremise, streetNumber, route].filter(Boolean).join(' ').trim() || undefined;

  return { street, city, state, postalCode, country };
}

async function geocodeFormattedAddress(formattedAddress: string): Promise<AddressParts | null> {
  const geocoder = await getGeocoderService();
  if (!geocoder) return null;

  return new Promise((resolve) => {
    geocoder.geocode({ address: formattedAddress }, (results: any[] | null, status: string) => {
      const google = getWindowGoogle();
      if (status !== google?.maps?.GeocoderStatus?.OK || !results?.length) {
        resolve(null);
        return;
      }
      resolve(extractAddressParts(results[0].address_components));
    });
  });
}

async function loadGoogleMapsPlacesSdk(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) return;

  if (getWindowGoogle()?.maps?.places) return;
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps Places SDK')));
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps Places SDK'));
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

async function getAutocompleteService() {
  await loadGoogleMapsPlacesSdk();
  const google = getWindowGoogle();
  if (!google?.maps?.places) return null;
  if (!autocompleteService) autocompleteService = new google.maps.places.AutocompleteService();
  return autocompleteService;
}

async function getGeocoderService() {
  await loadGoogleMapsPlacesSdk();
  const google = getWindowGoogle();
  if (!google?.maps) return null;
  if (!geocoderService) geocoderService = new google.maps.Geocoder();
  return geocoderService;
}

async function getPlacesDetailsService() {
  await loadGoogleMapsPlacesSdk();
  const google = getWindowGoogle();
  if (!google?.maps?.places) return null;
  if (!placesDetailsService) {
    placesDetailsService = new google.maps.places.PlacesService(document.createElement('div'));
  }
  return placesDetailsService;
}

/** Autocomplete for company / venue search: establishments, addresses, and geocodes (no `types` filter). */
export async function fetchCompanyPlacePredictions(input: string): Promise<AddressPrediction[]> {
  if (!isGooglePlacesConfigured()) return [];
  const query = input.trim();
  if (query.length < 2) return [];

  const service = await getAutocompleteService();
  if (!service) return [];

  return new Promise((resolve) => {
    service.getPlacePredictions({ input: query }, (predictions: any[] | null, status: string) => {
      const google = getWindowGoogle();
      if (status !== google?.maps?.places?.PlacesServiceStatus?.OK || !predictions?.length) {
        resolve([]);
        return;
      }

      resolve(
        predictions.map((prediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
        })),
      );
    });
  });
}

export async function fetchAddressPredictions(input: string, country?: string): Promise<AddressPrediction[]> {
  if (!isGooglePlacesConfigured()) return [];
  const query = input.trim();
  if (query.length < 3) return [];

  const service = await getAutocompleteService();
  if (!service) return [];

  return new Promise((resolve) => {
    service.getPlacePredictions(
      {
        input: query,
        types: ['address'],
        componentRestrictions: toCountryCode(country) ? { country: toCountryCode(country)! } : undefined,
      },
      (predictions: any[] | null, status: string) => {
        const google = getWindowGoogle();
        if (status !== google?.maps?.places?.PlacesServiceStatus?.OK || !predictions?.length) {
          resolve([]);
          return;
        }

        resolve(
          predictions.map((prediction) => ({
            placeId: prediction.place_id,
            description: prediction.description,
          })),
        );
      },
    );
  });
}

export async function fetchPlaceDetailsByPlaceId(
  placeId: string,
  /** Same row the user picked in Autocomplete — aligns state with the dropdown line. */
  autocompleteDescription?: string,
): Promise<PlaceDetailsResult | null> {
  if (!isGooglePlacesConfigured() || !placeId) return null;
  const service = await getPlacesDetailsService();
  if (!service) return null;

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ['address_components', 'name', 'formatted_address'],
      },
      async (place: any, status: string) => {
        const google = getWindowGoogle();
        if (status !== google?.maps?.places?.PlacesServiceStatus?.OK || !place?.address_components) {
          resolve(null);
          return;
        }

        try {
          const physical = extractPhysicalFromComponents(place.address_components);
          const postBox = componentByType(place.address_components, 'post_box')?.long_name;

          let mailing: AddressParts = extractAddressParts(place.address_components);
          if (postBox) {
            mailing = {
              ...mailing,
              street: `P.O. Box ${postBox}`.replace(/^P\.O\. Box P\.O\. Box /, 'P.O. Box '),
            };
          } else if (typeof place.formatted_address === 'string' && place.formatted_address.trim()) {
            const geocoded = await geocodeFormattedAddress(place.formatted_address);
            if (geocoded) mailing = geocoded;
          }

          const { physical: physOut, mailing: mailOut } = applyAutocompleteStateHint(
            physical,
            mailing,
            autocompleteDescription,
          );

          resolve({
            placeName: typeof place.name === 'string' ? place.name : undefined,
            formattedAddress: typeof place.formatted_address === 'string' ? place.formatted_address : undefined,
            physical: physOut,
            mailing: mailOut,
          });
        } catch {
          resolve(null);
        }
      },
    );
  });
}

export async function fetchAddressByPlaceId(placeId: string): Promise<AddressParts | null> {
  const full = await fetchPlaceDetailsByPlaceId(placeId);
  return full?.physical ?? null;
}

export async function fetchAddressByPostalCode(postalCode: string, country?: string): Promise<AddressParts | null> {
  if (!isGooglePlacesConfigured()) return null;
  const cleanPostal = postalCode.trim();
  if (cleanPostal.length < 3) return null;

  const geocoder = await getGeocoderService();
  if (!geocoder) return null;

  return new Promise((resolve) => {
    const query = country ? `${cleanPostal}, ${country}` : cleanPostal;
    geocoder.geocode({ address: query }, (results: any[] | null, status: string) => {
      const google = getWindowGoogle();
      if (status !== google?.maps?.GeocoderStatus?.OK || !results?.length) {
        resolve(null);
        return;
      }
      resolve(extractAddressParts(results[0].address_components));
    });
  });
}
