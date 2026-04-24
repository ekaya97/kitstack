import { useState, useEffect, useCallback } from "react";

// --- Config sources (priority order) ---
// 1. window.__KITSTACK_MCP__ — MCP channel mode (shell sets this before mounting)
// 2. window.__KITSTACK__ — JWT+fetch mode (injected by MCP server)
// 3. URL params + env var — website preview iframes
// 4. Mock data — dev mode fallback

interface McpBridge {
  callTool: (cmd: string, params: Record<string, unknown>) => Promise<any>;
  kit: string;
  view: string;
}

const mcp = (window as any).__KITSTACK_MCP__ as McpBridge | undefined;

const ks = (window as any).__KITSTACK__ as
  | { token: string; appDataUrl: string; kit: string }
  | undefined;

const APP_DATA_URL = ks?.appDataUrl || import.meta.env.VITE_APP_DATA_URL || "";

function getToken(): string | null {
  return ks?.token || new URLSearchParams(window.location.search).get("token");
}

function getParam(name: string): string | null {
  if (name === "kit") {
    if (mcp?.kit) return mcp.kit;
    if (ks?.kit) return ks.kit;
  }
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

// MCP channel mode: fetch data via callServerTool through the shell's postMessage bridge
function useMcpData<T>(
  view: string,
  filter?: string
): {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!mcp) return;

    setLoading(true);
    setError(null);

    // Map view names to kit tool commands
    // The view name matches the table name in the app-data handler
    const cmd = `list_${view}` === "list_sequences" ? "list_sequences" : "list_sequences";

    mcp
      .callTool("export_sequence", { sequenceId: "" })
      .catch(() => {
        // Fallback: try a generic list command
        return mcp.callTool("list_sequences", {});
      })
      .then((result) => {
        // Parse the text result — MCP tools return markdown text, not structured data
        // The React component needs to handle the text format
        const text = result?.content?.find?.((c: any) => c.type === "text")?.text;
        setData(text ? ([{ _raw: text }] as any) : []);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load data");
        setLoading(false);
      });
  }, [view, filter, tick]);

  return { data, loading, error, refetch };
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
  const mock = useMockData<T>(view);
  const mcpResult = useMcpData<T>(view, filter);

  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const kit = getParam("kit") || "crm";
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // MCP mode — data flows through the shell's postMessage bridge
  if (mcp) return mcpResult;

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
