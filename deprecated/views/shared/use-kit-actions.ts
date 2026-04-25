import { useState, useCallback, useRef } from "react";

interface McpBridge {
  downloadFile?: (filename: string, mimeType: string, content: string) => Promise<any>;
  openLink?: (url: string) => Promise<any>;
  copyToClipboard?: (text: string) => Promise<void>;
  capabilities?: {
    downloadFile: boolean;
    openLinks: boolean;
    clipboardWrite: boolean;
  };
}

function getBridge(): McpBridge | null {
  return (window as any).__KITSTACK_MCP__ ?? null;
}

type ActionState = "idle" | "loading" | "success" | "error";

/**
 * Returns a function wrapper that tracks loading/success/error state per action.
 * Usage: const [doExport, exportState] = useAction(async () => { ... });
 */
export function useAction(fn: () => Promise<void>): [() => void, ActionState] {
  const [state, setState] = useState<ActionState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const run = useCallback(() => {
    setState("loading");
    if (timer.current) clearTimeout(timer.current);
    fn()
      .then(() => {
        setState("success");
        timer.current = setTimeout(() => setState("idle"), 2000);
      })
      .catch(() => {
        setState("error");
        timer.current = setTimeout(() => setState("idle"), 2000);
      });
  }, [fn]);

  return [run, state];
}

/**
 * Hook for file operations in MCP App views.
 */
export function useKitActions() {
  const bridge = getBridge();
  const caps = bridge?.capabilities;

  const downloadFile = useCallback(async (filename: string, mimeType: string, content: string) => {
    if (bridge?.downloadFile && caps?.downloadFile) {
      await bridge.downloadFile(filename, mimeType, content);
    } else {
      // Fallback to clipboard
      await (bridge?.copyToClipboard ?? navigator.clipboard.writeText.bind(navigator.clipboard))(content);
    }
  }, [bridge, caps]);

  const openLink = useCallback(async (url: string) => {
    if (bridge?.openLink && caps?.openLinks) {
      await bridge.openLink(url);
    }
  }, [bridge, caps]);

  const copyToClipboard = useCallback(async (text: string) => {
    if (bridge?.copyToClipboard) {
      await bridge.copyToClipboard(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
  }, [bridge]);

  return {
    canDownload: !!caps?.downloadFile,
    canOpenLink: !!caps?.openLinks,
    canCopy: true,
    downloadFile,
    openLink,
    copyToClipboard,
  };
}
