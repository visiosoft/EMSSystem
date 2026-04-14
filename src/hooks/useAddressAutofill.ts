import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAddressByPlaceId,
  fetchAddressByPostalCode,
  fetchAddressPredictions,
  isGooglePlacesConfigured,
  type AddressParts,
  type AddressPrediction,
} from '@/lib/googlePlaces';

interface AddressValue {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface UseAddressAutofillArgs {
  value: AddressValue;
  onPatch: (patch: Partial<AddressValue>) => void;
  enabled?: boolean;
}

function toPatch(parts: AddressParts): Partial<AddressValue> {
  const patch: Partial<AddressValue> = {};
  if (parts.street) patch.street = parts.street;
  if (parts.city) patch.city = parts.city;
  if (parts.state) patch.state = parts.state;
  if (parts.postalCode) patch.postalCode = parts.postalCode;
  if (parts.country) patch.country = parts.country;
  return patch;
}

export function useAddressAutofill({ value, onPatch, enabled = true }: UseAddressAutofillArgs) {
  const [suggestions, setSuggestions] = useState<AddressPrediction[]>([]);
  const [isStreetFocused, setIsStreetFocused] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isResolvingPostal, setIsResolvingPostal] = useState(false);
  const requestSeqRef = useRef(0);
  const blurTimerRef = useRef<number | null>(null);

  const configured = useMemo(() => isGooglePlacesConfigured(), []);

  useEffect(() => {
    if (!enabled || !configured) {
      setSuggestions([]);
      return;
    }

    const query = value.street.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    setIsLoadingSuggestions(true);

    const timer = window.setTimeout(async () => {
      try {
        const results = await fetchAddressPredictions(query, value.country);
        if (requestSeqRef.current === currentSeq) {
          setSuggestions(results);
        }
      } finally {
        if (requestSeqRef.current === currentSeq) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [configured, enabled, value.street, value.country]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  const selectSuggestion = async (prediction: AddressPrediction) => {
    if (!enabled || !configured) return;

    const resolved = await fetchAddressByPlaceId(prediction.placeId);
    setSuggestions([]);
    setIsStreetFocused(false);

    if (!resolved) return;
    onPatch(toPatch(resolved));
  };

  const resolveByPostalCode = async () => {
    if (!configured) return;
    const postalCode = value.postalCode.trim();
    if (postalCode.length < 3) return;

    setIsResolvingPostal(true);
    try {
      const resolved = await fetchAddressByPostalCode(postalCode, value.country);
      if (!resolved) return;

      const patch = toPatch(resolved);
      if (!value.street.trim()) {
        patch.street = resolved.street || value.street;
      } else {
        delete patch.street;
      }
      onPatch(patch);
    } finally {
      setIsResolvingPostal(false);
    }
  };

  return {
    configured,
    suggestions,
    isLoadingSuggestions,
    isResolvingPostal,
    showSuggestions: enabled && isStreetFocused && suggestions.length > 0,
    onStreetFocus: () => setIsStreetFocused(true),
    onStreetBlur: () => {
      blurTimerRef.current = window.setTimeout(() => setIsStreetFocused(false), 120);
    },
    clearSuggestions: () => setSuggestions([]),
    selectSuggestion,
    resolveByPostalCode,
  };
}
