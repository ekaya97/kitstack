import { useState, useCallback, useRef } from "react";

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

interface Kit<TData> {
  data: TData;
  reload: () => Promise<void>;
  callTool: (name: string, params?: Record<string, unknown>) => Promise<string>;
  capabilities: {
    downloadFile: boolean;
    openLinks: boolean;
    clipboardWrite: boolean;
  };
}

export function useKit<TData = unknown>(): Kit<TData> {
  const [data, setData] = useState<TData>(() => (window as any).__KITSTACK_DATA__ as TData);
  const bridge = getBridge();

  const reload = useCallback(async () => {
    if (!bridge) return;
    const result = await bridge.callTool("__reload_view", {});
    try {
      const parsed = JSON.parse(result);
      if (parsed.data) setData(parsed.data as TData);
    } catch {
      // non-JSON response — ignore
    }
  }, [bridge]);

  const callTool = useCallback(
    async (name: string, params?: Record<string, unknown>) => {
      if (!bridge) throw new Error("MCP bridge not available");
      return bridge.callTool(name, params);
    },
    [bridge]
  );

  return {
    data,
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
