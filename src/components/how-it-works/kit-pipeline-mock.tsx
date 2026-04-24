const cols = [
  {
    stage: "Lead",
    color: "#b8ae9b",
    deals: [
      { name: "Acme Bakery", value: 18000 },
      { name: "Nordic Supply", value: 6500 },
    ],
  },
  {
    stage: "Proposal",
    color: "#d65a2f",
    deals: [{ name: "Kreuz Studio", value: 22000 }],
  },
  {
    stage: "Won",
    color: "#3b7a3b",
    deals: [{ name: "BerlinBrew", value: 9500 }],
  },
];

export function KitPipelineMock() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-ks-paper-warm">
      <div className="bg-ks-paper-deep px-4 py-2.5 border-b border-ks-hair flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-[#d97757] flex items-center justify-center shrink-0">
          <span className="text-white font-serif text-[10px] font-bold">C</span>
        </div>
        <span className="font-mono text-[11px] text-ks-muted">
          Claude &middot; CRM Kit
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ks-accent" />
          <span className="font-mono text-[10px] text-ks-accent">Kit connected</span>
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* User message */}
        <div className="flex gap-2.5">
          <div className="w-5 h-5 rounded-full bg-ks-paper-deep flex items-center justify-center shrink-0 mt-0.5">
            <span className="font-sans text-[10px] text-ks-muted font-semibold">U</span>
          </div>
          <div className="font-sans text-[12px] text-ks-ink leading-relaxed">
            Show my pipeline
          </div>
        </div>

        {/* Claude response with inline kanban */}
        <div className="flex gap-2.5">
          <div className="w-5 h-5 rounded bg-[#d97757] flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white font-serif text-[9px] font-bold">C</span>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="font-sans text-[12px] text-ks-ink leading-relaxed">
              Here&apos;s your current pipeline:
            </div>

            {/* Mini kanban */}
            <div className="grid grid-cols-3 gap-1.5">
              {cols.map((c) => (
                <div
                  key={c.stage}
                  className="bg-white border border-ks-hair rounded p-1.5"
                >
                  <div className="flex items-center gap-1 mb-1.5">
                    <span
                      className="w-[6px] h-[6px] rounded-full shrink-0"
                      style={{ background: c.color }}
                    />
                    <span className="font-mono text-[9px] text-ks-muted font-semibold tracking-wide">
                      {c.stage.toUpperCase()}
                    </span>
                  </div>
                  {c.deals.map((d, i) => (
                    <div
                      key={i}
                      className="bg-ks-paper-warm p-1.5 rounded mb-1 last:mb-0"
                    >
                      <div className="font-sans text-[10px] text-ks-ink font-medium leading-tight">
                        {d.name}
                      </div>
                      <div className="font-mono text-[9px] text-ks-accent mt-0.5">
                        &euro;{d.value.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="font-sans text-[11px] text-ks-muted">
              3 stages &middot; &euro;56,000 total pipeline value
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-ks-hair">
        An interactive pipeline board rendered inside Claude&apos;s chat
      </div>
    </div>
  );
}
