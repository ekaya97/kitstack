"use client";

import { useMemo, useState } from "react";
import type { ViewHost } from "@kitstackco/sdk";
import { ADINT_VIEWS, getAdintView } from "./view-catalog";

const ADINT_IDENTITY = { principal: "adint-demo-user", actor: "adint-demo-user" };

export type ShellHostProps = {
  initialView?: string;
};

/**
 * Generic KitStack shell host with adint registered as the first tenant.
 * A host supplies the boundary; a kit supplies the View renderer.
 */
export function ShellHost({ initialView = "graph" }: ShellHostProps) {
  const [selectedViewId, setSelectedViewId] = useState(() => getAdintView(initialView).id);
  const selectedView = useMemo(() => getAdintView(selectedViewId), [selectedViewId]);

  function navigate(viewId: string) {
    const nextView = getAdintView(viewId);
    setSelectedViewId(nextView.id);
    window.history.replaceState(null, "", `/host?kit=adint&view=${encodeURIComponent(nextView.id)}`);
  }

  const host: ViewHost = {
    kind: "shell",
    size: { width: 960, height: selectedView.height },
    navigate,
    identity: ADINT_IDENTITY,
    theme: { mode: "light" },
  };

  return (
    <main className="min-h-screen bg-ks-paper px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-ks-hair pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-ks-accent">KitStack / shell host</div>
            <h1 className="mt-2 font-serif text-[38px] leading-none tracking-tight">Ad intelligence</h1>
            <p className="mt-2 max-w-xl text-[14px] text-ks-muted">One host contract, one tenant, and the same Views that can render in an MCP chat surface.</p>
          </div>
          <div className="rounded-xl border border-ks-hair bg-white px-4 py-3 text-right">
            <div className="font-mono text-[10px] uppercase tracking-[1px] text-ks-muted">Tenant</div>
            <div className="mt-1 text-[13px] font-semibold text-ks-ink">adint</div>
            <div className="mt-1 font-mono text-[10px] text-ks-muted">host.kind = shell</div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="ks-card h-fit p-3">
            <div className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[1px] text-ks-muted">Adint Views</div>
            <nav aria-label="Adint Views" className="grid gap-1">
              {ADINT_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => navigate(view.id)}
                  aria-current={selectedView.id === view.id ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${selectedView.id === view.id ? "bg-ks-ink font-semibold text-white" : "text-ks-muted hover:bg-ks-paper hover:text-ks-ink"}`}
                >
                  <span className="block">{view.name}</span>
                  <span className={`mt-0.5 block text-[11px] ${selectedView.id === view.id ? "text-white/70" : "text-ks-muted"}`}>{view.description}</span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="ks-card min-w-0 overflow-hidden" aria-label={`${selectedView.name} shell view`}>
            <div className="flex items-center justify-between border-b border-ks-hair px-5 py-4">
              <div>
                <h2 className="font-serif text-[24px] text-ks-ink">{selectedView.name}</h2>
                <p className="mt-1 text-[12px] text-ks-muted">Rendered through the SDK ViewHost boundary.</p>
              </div>
              <span className="rounded-full border border-ks-accent/40 bg-ks-accent-soft px-2.5 py-1 font-mono text-[10px] text-ks-accent-deep">shell</span>
            </div>
            <div data-testid="view-shell-host" data-kitstack-host={host.kind} className="min-h-[400px] bg-white">
              {selectedView.render(selectedView.data, host)}
            </div>
          </section>
        </div>

        <p className="mt-4 text-[11px] text-ks-muted">Demo snapshot only. Production loaders remain server-owned and will bind to this host through the kit registry/runtime.</p>
      </div>
    </main>
  );
}
