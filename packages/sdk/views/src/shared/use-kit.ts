import { useState, useCallback, useRef, useEffect } from "react";

// ─── Bridge types ────────────────────────────────────────────

interface KitBridge {
  callTool: (cmd: string, params?: Record<string, unknown>) => Promise<string>;
  kit: string;
  view: string;
  capabilities: {
    downloadFile: boolean;
    openLinks: boolean;
    clipboardWrite: boolean;
  };
  downloadFile: (filename: string, mimeType: string, content: string) => Promise<void>;
  openLink: (url: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
}

function getBridge(): KitBridge | null {
  return (window as any).__KITSTACK_MCP__ ?? null;
}

// ─── useKit ──────────────────────────────────────────────────

interface KitOptions {
  /** Auto-reload fresh data from the loader on mount. Default: true. */
  reloadOnMount?: boolean;
}

interface Kit<TData> {
  data: TData;
  loading: boolean;
  reload: () => Promise<void>;
  callTool: (name: string, params?: Record<string, unknown>) => Promise<string>;
  capabilities: {
    downloadFile: boolean;
    openLinks: boolean;
    clipboardWrite: boolean;
  };
}

export function useKit<TData = unknown>(opts?: KitOptions): Kit<TData> {
  const [data, setData] = useState<TData>(() => (window as any).__KITSTACK_DATA__ as TData);
  const [loading, setLoading] = useState(false);
  const bridge = getBridge();
  const hasReloadedOnMount = useRef(false);
  const reloadOnMount = opts?.reloadOnMount ?? true;

  const reload = useCallback(async () => {
    if (!bridge) return;
    setLoading(true);
    try {
      const result = await bridge.callTool("__load_view", { view: bridge.view }) as any;
      const text = typeof result === "string" ? result
        : result?.content?.find?.((c: any) => c.type === "text")?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.data != null) setData(parsed.data as TData);
      }
    } catch {
      // parse failed — ignore
    } finally {
      setLoading(false);
    }
  }, [bridge]);

  // On mount: if pre-loaded data is empty, auto-fetch from the loader.
  // If data is already populated (placeholder or cached tool-result),
  // render it immediately without a network round-trip.
  // The user/LLM can trigger reload() explicitly to get fresh data.
  // Opt-out entirely with { reloadOnMount: false }.
  useEffect(() => {
    if (!reloadOnMount || hasReloadedOnMount.current || !bridge) return;
    hasReloadedOnMount.current = true;
    // Skip if we already have non-empty data
    const empty = data == null
      || (Array.isArray(data) && data.length === 0)
      || (typeof data === "object" && !Array.isArray(data) && Object.keys(data as object).length === 0);
    if (!empty) return;
    reload();
  }, [bridge, reload, reloadOnMount]); // eslint-disable-line react-hooks/exhaustive-deps

  const callTool = useCallback(
    async (name: string, params?: Record<string, unknown>) => {
      if (!bridge) throw new Error("MCP bridge not available");
      return bridge.callTool(name, params);
    },
    [bridge]
  );

  return {
    data,
    loading,
    reload,
    callTool,
    capabilities: bridge?.capabilities ?? {
      downloadFile: false,
      openLinks: false,
      clipboardWrite: false,
    },
  };
}

// ─── useTool ─────────────────────────────────────────────────

interface ToolAction {
  call: (params: Record<string, unknown>) => Promise<void>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useTool(
  name: string,
  opts?: { invalidate?: () => Promise<void> }
): ToolAction {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bridge = getBridge();

  const call = useCallback(
    async (params: Record<string, unknown>) => {
      if (!bridge) throw new Error("MCP bridge not available");
      setLoading(true);
      setError(null);
      try {
        await bridge.callTool(name, params);
        if (opts?.invalidate) await opts.invalidate();
      } catch (e: any) {
        setError(e.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [bridge, name, opts?.invalidate]
  );

  const reset = useCallback(() => setError(null), []);

  return { call, loading, error, reset };
}

// ─── useFile ─────────────────────────────────────────────────

interface FileActions {
  download: (filename: string, mimeType: string, content: string) => Promise<void>;
  open: (opts: { accept: string; onFile: (text: string) => Promise<void> }) => void;
  copy: (text: string) => Promise<void>;
  canDownload: boolean;
  importing: boolean;
  feedback: string | null;
}

export function useFile(): FileActions {
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridge = getBridge();

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  }, []);

  const download = useCallback(
    async (filename: string, mimeType: string, content: string) => {
      if (bridge?.capabilities.downloadFile) {
        await bridge.downloadFile(filename, mimeType, content);
        showFeedback(`Downloaded ${filename}`);
      } else {
        await (bridge?.copyToClipboard(content) ??
          navigator.clipboard.writeText(content));
        showFeedback("Copied to clipboard");
      }
    },
    [bridge, showFeedback]
  );

  const open = useCallback(
    (opts: { accept: string; onFile: (text: string) => Promise<void> }) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = opts.accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
          const text = await file.text();
          await opts.onFile(text);
          showFeedback(`Imported ${file.name}`);
        } catch (e: any) {
          showFeedback(`Import failed: ${e.message}`);
        } finally {
          setImporting(false);
        }
      };
      input.click();
    },
    [showFeedback]
  );

  const copy = useCallback(
    async (text: string) => {
      await (bridge?.copyToClipboard(text) ??
        navigator.clipboard.writeText(text));
      showFeedback("Copied to clipboard");
    },
    [bridge, showFeedback]
  );

  return {
    download,
    open,
    copy,
    canDownload: bridge?.capabilities.downloadFile ?? false,
    importing,
    feedback,
  };
}
