import { useEffect, useRef, useState } from 'react';
import {
  fetchCompanyPlacePredictions,
  fetchPlaceDetailsByPlaceId,
  isGooglePlacesConfigured,
  type AddressPrediction,
  type PlaceDetailsResult,
} from '@/lib/googlePlaces';

interface UseCompanyPlaceSearchArgs {
  query: string;
  onPlaceResolved: (details: PlaceDetailsResult) => void;
}

export function useCompanyPlaceSearch({ query, onPlaceResolved }: UseCompanyPlaceSearchArgs) {
  const [suggestions, setSuggestions] = useState<AddressPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const requestSeqRef = useRef(0);
  const blurTimerRef = useRef<number | null>(null);

  const configured = isGooglePlacesConfigured();

  useEffect(() => {
    if (!configured) {
      setSuggestions([]);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const list = await fetchCompanyPlacePredictions(q);
        if (requestSeqRef.current === seq) {
          setSuggestions(list);
        }
      } finally {
        if (requestSeqRef.current === seq) {
          setLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, configured]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  const selectPrediction = async (prediction: AddressPrediction) => {
    if (!configured) return;
    const details = await fetchPlaceDetailsByPlaceId(prediction.placeId);
    setSuggestions([]);
    setMenuOpen(false);
    if (details) onPlaceResolved(details);
  };

  return {
    configured,
    suggestions,
    loading,
    menuOpen: configured && menuOpen && (suggestions.length > 0 || loading),
    onNameFocus: () => setMenuOpen(true),
    onNameBlur: () => {
      blurTimerRef.current = window.setTimeout(() => setMenuOpen(false), 150);
    },
    selectPrediction,
    clearSuggestions: () => setSuggestions([]),
  };
}
