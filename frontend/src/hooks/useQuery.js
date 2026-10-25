import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Generic data-fetching hook with loading, error, and refresh support.
 * Avoids stale closures by using a ref for the fetch function.
 */
export function useQuery(fetchFn, deps = [], options = {}) {
  const { immediate = true, onSuccess, onError } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(new Map());
  const requestKey = JSON.stringify(deps);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(() => {
    if (inFlightRef.current.has(requestKey)) {
      return inFlightRef.current.get(requestKey);
    }

    setLoading(true);
    setError(null);
    const request = (async () => {
      try {
        const result = await fetchFnRef.current();
        if (isMountedRef.current) {
          setData(result);
          onSuccess?.(result);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err);
          onError?.(err);
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
        if (inFlightRef.current.get(requestKey) === request) {
          inFlightRef.current.delete(requestKey);
        }
      }
    })();
    inFlightRef.current.set(requestKey, request);
    return request;
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, [...deps, requestKey]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

/**
 * Polling hook — re-fetches data every `intervalMs` milliseconds.
 */
export function usePolling(fetchFn, deps = [], intervalMs = 30000) {
  const result = useQuery(fetchFn, deps);
  const { refetch } = result;

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") refetch();
    };
    const id = setInterval(poll, intervalMs);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refetch, intervalMs]);

  return result;
}
