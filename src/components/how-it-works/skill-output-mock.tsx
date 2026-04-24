export function SkillOutputMock() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-ks-paper-warm">
      <div className="bg-ks-paper-deep px-4 py-2.5 border-b border-ks-hair flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-[#d97757] flex items-center justify-center shrink-0">
          <span className="text-white font-serif text-[10px] font-bold">C</span>
        </div>
        <span className="font-mono text-[11px] text-ks-muted">
          Claude &middot; Proposal Skill active
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
          <span className="font-mono text-[10px] text-green-700">Skill loaded</span>
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* User message */}
        <div className="flex gap-2.5">
          <div className="w-5 h-5 rounded-full bg-ks-paper-deep flex items-center justify-center shrink-0 mt-0.5">
            <span className="font-sans text-[10px] text-ks-muted font-semibold">U</span>
          </div>
          <div className="font-sans text-[12px] text-ks-ink leading-relaxed">
            Write a proposal for Acme Corp — website redesign, budget around &euro;25k
          </div>
        </div>

        {/* Claude response */}
        <div className="flex gap-2.5">
          <div className="w-5 h-5 rounded bg-[#d97757] flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white font-serif text-[9px] font-bold">C</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-sans text-[12px] text-ks-ink leading-relaxed space-y-2">
              <div className="font-mono text-[10px] text-ks-accent tracking-wider font-semibold">
                PROPOSAL &mdash; ACME CORP WEBSITE REDESIGN
              </div>
              <div className="border-l-2 border-ks-accent pl-3 space-y-1.5">
                <div>
                  <span className="font-mono text-[10px] text-ks-muted">EXECUTIVE SUMMARY</span>
                  <p className="text-[11.5px] text-ks-ink2 mt-0.5">
                    Full redesign of acme-corp.com with modern stack,
                    mobile-first approach, and CMS integration&hellip;
                  </p>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-ks-muted">SCOPE & DELIVERABLES</span>
                  <div className="text-[11.5px] text-ks-ink2 mt-0.5 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-700 text-[10px]">&#10003;</span>
                      UX audit & wireframes (4 weeks)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-700 text-[10px]">&#10003;</span>
                      Visual design — 3 concepts (3 weeks)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-700 text-[10px]">&#10003;</span>
                      Development & CMS setup (5 weeks)
                    </div>
                  </div>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-ks-muted">INVESTMENT</span>
                  <p className="text-[11.5px] text-ks-ink2 mt-0.5">
                    <span className="font-mono text-ks-accent font-semibold">&euro;24,800</span>
                    {" "}&mdash; 3 milestones, net-14 terms
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-ks-hair">
        Claude produces expert-level output with the skill installed
      </div>
    </div>
  );
}
