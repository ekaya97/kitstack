import type { ReactNode } from "react";

interface AppShellProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function AppShell({ title, children, loading, error, onRetry }: AppShellProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 p-6">
        <div className="text-ks-accent font-mono text-xs tracking-wide uppercase">Error</div>
        <p className="text-ks-muted text-center max-w-sm">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-1.5 text-xs font-medium rounded-full border border-ks-hair hover:bg-ks-paper-warm transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-2 p-6">
        <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
        <p className="text-ks-muted text-xs">Loading {title.toLowerCase()}...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">{title}</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>
      {children}
    </div>
  );
}
