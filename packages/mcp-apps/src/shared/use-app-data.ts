import { useState, useEffect, useCallback } from "react";

const APP_DATA_URL = import.meta.env.VITE_APP_DATA_URL || "";

function getToken(): string | null {
  return new URLSearchParams(window.location.search).get("token");
}

function getParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export { getToken, getParam };

function useMockData<T>(view: string): {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("./mock-data").then((mod) => {
      setData((mod.MOCK_DATA[view] as T[]) ?? []);
      setLoading(false);
    });
  }, [view]);

  return { data, loading, error: null, refetch: () => {} };
}

export function useAppData<T>(
  view: string,
  filter?: string
): {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const token = getToken();

  // Dev mode: no token → use mock data
  const mock = useMockData<T>(view);
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const kit = getParam("kit") || "crm";
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const useMock = !token && (!APP_DATA_URL || import.meta.env.DEV);

  useEffect(() => {
    if (useMock) return;

    if (!token) {
      setError("Missing token");
      setLoading(false);
      return;
    }
    if (!APP_DATA_URL) {
      setError("App data URL not configured");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ token, kit, view });
    if (filter) params.set("filter", filter);

    fetch(`${APP_DATA_URL}?${params}`)
      .then((res) => {
        if (res.status === 401) throw new Error("Token expired — please refresh");
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
        return res.json();
      })
      .then((body) => {
        setData(body.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token, kit, view, filter, tick, useMock]);

  if (useMock) return mock;
  return { data, loading, error, refetch };
}
