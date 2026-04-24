export function ChatGPTCreateGPT() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#212121]">
      <div className="flex">
        {/* Left: Configure form */}
        <div className="flex-1 border-r border-[#353535] px-4 py-3">
          {/* Tabs */}
          <div className="flex gap-4 mb-3 border-b border-[#353535] pb-2">
            <span className="font-sans text-[11px] text-[#8e8ea0]">
              Create
            </span>
            <span className="font-sans text-[11px] text-[#ececec] font-medium border-b border-[#ececec] pb-2 -mb-[9px]">
              Configure
            </span>
          </div>

          {/* Profile image */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-full bg-[#10a37f] flex items-center justify-center">
              <span className="text-white font-sans text-[14px] font-bold">P</span>
            </div>
          </div>

          {/* Name */}
          <div className="mb-2.5">
            <label className="font-sans text-[10px] text-[#8e8ea0] font-medium mb-1 block">
              Name
            </label>
            <div className="rounded-lg bg-[#2f2f2f] border border-[#353535] px-3 py-1.5">
              <span className="font-sans text-[11px] text-[#ececec]">
                Proposal Skill
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="mb-2.5">
            <label className="font-sans text-[10px] text-[#8e8ea0] font-medium mb-1 block">
              Description
            </label>
            <div className="rounded-lg bg-[#2f2f2f] border border-[#353535] px-3 py-1.5">
              <span className="font-sans text-[11px] text-[#8e8ea0]">
                Generate professional client proposals
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-2.5">
            <label className="font-sans text-[10px] text-[#8e8ea0] font-medium mb-1 block">
              Instructions
            </label>
            <div className="rounded-lg bg-[#2f2f2f] border-2 border-[#10a37f] px-3 py-2 max-h-[56px] overflow-hidden relative">
              <div className="font-mono text-[9.5px] text-[#ececec] leading-relaxed">
                # Client Proposal Skill<br />
                <span className="text-[#8e8ea0]">You are a senior business development consultant who has written 500+ winning proposals&hellip;</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-[#2f2f2f]" />
            </div>
          </div>

          {/* Knowledge */}
          <div>
            <label className="font-sans text-[10px] text-[#8e8ea0] font-medium mb-1 block">
              Knowledge
            </label>
            <div className="flex flex-wrap gap-1">
              {["pricing-frameworks.md", "scope-templates.md", "objection-handlers.md"].map((f) => (
                <div key={f} className="bg-[#2f2f2f] border border-[#353535] rounded px-2 py-1 flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-[#8e8ea0] shrink-0">
                    <path d="M4.5 1.5h5l4 4v9a1 1 0 01-1 1h-8a1 1 0 01-1-1v-12a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M9.5 1.5v4h4" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  <span className="font-sans text-[9px] text-[#ececec] truncate">
                    {f}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="w-[120px] px-3 py-3 flex flex-col items-center justify-center">
          <div className="font-sans text-[10px] text-[#8e8ea0] mb-2">Preview</div>
          <div className="w-10 h-10 rounded-full bg-[#10a37f] flex items-center justify-center mb-1.5">
            <span className="text-white font-sans text-[14px] font-bold">P</span>
          </div>
          <div className="font-sans text-[10px] text-[#ececec] font-medium text-center mb-3">
            Proposal Skill
          </div>
          <div className="w-full bg-[#2f2f2f] rounded-lg px-2 py-1.5 text-center">
            <span className="font-sans text-[9px] text-[#8e8ea0]">
              Message&hellip;
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#353535]">
        Step 2: Create a custom GPT with skill instructions
      </div>
    </div>
  );
}
