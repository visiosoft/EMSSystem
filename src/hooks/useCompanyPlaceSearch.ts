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
      setLoading(false);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
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
      })();
    }, 250);

    return () => {
      window.clearTimeout(timer);
      // Timer cleared before fetch: stop loading. In-flight fetches use seq to avoid stale updates.
      if (requestSeqRef.current === seq) {
        setLoading(false);
      }
    };
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

  const qTrim = query.trim();
  const listVisible =
    configured && menuOpen && qTrim.length >= 2;

  return {
    configured,
    suggestions,
    loading,
    /** True when the suggestions panel should be shown (search long enough, regardless of 0 results). */
    listVisible,
    onNameFocus: () => setMenuOpen(true),
    onNameBlur: () => {
      blurTimerRef.current = window.setTimeout(() => setMenuOpen(false), 150);
    },
    selectPrediction,
    clearSuggestions: () => setSuggestions([]),
  };
}
