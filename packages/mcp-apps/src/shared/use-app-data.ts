import { useState, useEffect, useCallback } from "react";

// Config sources:
// 1. window.__KITSTACK__ — JWT+fetch mode (set by shell after getting token via MCP channel)
// 2. URL params + env var — website preview iframes
// 3. Mock data — dev mode fallback

function getKsConfig() {
  return (window as any).__KITSTACK__ as
    | { token: string; appDataUrl: string; kit: string }
    | undefined;
}

function getAppDataUrl(): string {
  return getKsConfig()?.appDataUrl || import.meta.env.VITE_APP_DATA_URL || "";
}

function getToken(): string | null {
  return getKsConfig()?.token || new URLSearchParams(window.location.search).get("token");
}

function getParam(name: string): string | null {
  if (name === "kit" && getKsConfig()?.kit) return getKsConfig()!.kit;
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
  const mock = useMockData<T>(view);
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const kit = getParam("kit") || "crm";
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const token = getToken();
  const appDataUrl = getAppDataUrl();
  const useMock = !token && (!appDataUrl || import.meta.env.DEV);

  useEffect(() => {
    if (useMock) return;

    if (!token) {
      setError("Missing token");
      setLoading(false);
      return;
    }
    if (!appDataUrl) {
      setError("App data URL not configured");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ token, kit, view });
    if (filter) params.set("filter", filter);

    fetch(`${appDataUrl}?${params}`)
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
  }, [token, kit, view, filter, tick, useMock, appDataUrl]);

  if (useMock) return mock;
  return { data, loading, error, refetch };
}
