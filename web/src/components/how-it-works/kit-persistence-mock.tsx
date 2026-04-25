export function KitPersistenceMock() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-ks-paper-warm">
      <div className="bg-ks-paper-deep px-4 py-2.5 border-b border-ks-hair flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-ks-accent shrink-0">
          <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5 2v3h6V2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="10" r="2" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span className="font-mono text-[11px] text-ks-ink font-medium">
          Persistent storage
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Conversation 1 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[9px] text-ks-faint tracking-wider">MONDAY</div>
            <div className="flex-1 h-px bg-ks-hair" />
          </div>
          <div className="flex gap-2.5">
            <div className="w-5 h-5 rounded-full bg-ks-paper-deep flex items-center justify-center shrink-0">
              <span className="font-sans text-[10px] text-ks-muted font-semibold">U</span>
            </div>
            <div className="font-sans text-[11.5px] text-ks-ink leading-relaxed">
              Add expense: Adobe CC, &euro;59.99, Software
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="w-5 h-5 rounded bg-[#d97757] flex items-center justify-center shrink-0">
              <span className="text-white font-serif text-[9px] font-bold">C</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[11.5px] text-ks-ink2">
                Saved. Your April total is now <span className="font-mono text-ks-accent font-semibold">&euro;59.99</span>
              </div>
              <div className="mt-1 bg-white border border-ks-hair rounded px-2.5 py-1.5 flex items-center gap-3">
                <div className="font-mono text-[9px] text-ks-muted">04/14</div>
                <div className="font-sans text-[10.5px] text-ks-ink">Adobe CC</div>
                <div className="font-mono text-[10px] text-ks-ink ml-auto">&euro;59.99</div>
                <span className="font-mono text-[9px] text-ks-faint px-1.5 py-px rounded border border-ks-hair">Software</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider with persistence indicator */}
        <div className="flex items-center gap-2 py-0.5">
          <div className="flex-1 h-px bg-ks-hair" />
          <div className="flex items-center gap-1 px-2 py-0.5 bg-ks-paper-deep rounded-full">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-green-700">
              <path d="M2 8a6 6 0 1112 0A6 6 0 012 8z" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 8l2 2 3-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-[9px] text-green-700">data saved</span>
          </div>
          <div className="flex-1 h-px bg-ks-hair" />
        </div>

        {/* Conversation 2 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[9px] text-ks-faint tracking-wider">THURSDAY</div>
            <div className="flex-1 h-px bg-ks-hair" />
          </div>
          <div className="flex gap-2.5">
            <div className="w-5 h-5 rounded-full bg-ks-paper-deep flex items-center justify-center shrink-0">
              <span className="font-sans text-[10px] text-ks-muted font-semibold">U</span>
            </div>
            <div className="font-sans text-[11.5px] text-ks-ink leading-relaxed">
              What&apos;s my April spend so far?
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="w-5 h-5 rounded bg-[#d97757] flex items-center justify-center shrink-0">
              <span className="text-white font-serif text-[9px] font-bold">C</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[11.5px] text-ks-ink2">
                You have <span className="font-mono font-semibold">3 expenses</span> this month totaling <span className="font-mono text-ks-accent font-semibold">&euro;291.99</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {[
                  { date: "04/14", desc: "Adobe CC", amt: "€59.99" },
                  { date: "04/10", desc: "DB Berlin→Munich", amt: "€142.00" },
                  { date: "04/08", desc: "Hotel Ibis Munich", amt: "€89.00" },
                ].map((r, i) => (
                  <div key={i} className="bg-white border border-ks-hair rounded px-2.5 py-1 flex items-center gap-3">
                    <div className="font-mono text-[9px] text-ks-muted">{r.date}</div>
                    <div className="font-sans text-[10.5px] text-ks-ink">{r.desc}</div>
                    <div className="font-mono text-[10px] text-ks-ink ml-auto">{r.amt}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-ks-hair">
        Your data persists across conversations &mdash; pick up where you left off
      </div>
    </div>
  );
}
