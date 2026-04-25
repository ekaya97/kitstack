export function GeminiGemEditor() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#1a1a2e]">
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#6b5c8a] flex items-center justify-center">
              <span className="text-white font-sans text-[10px] font-bold">C</span>
            </div>
            <span className="font-sans text-[12px] text-[#e8e8e8] font-medium">
              client proposal skill
            </span>
          </div>
          <button className="px-2.5 py-1 rounded-full bg-[#4a4ad4] font-sans text-[10px] text-white font-medium">
            Save
          </button>
        </div>

        {/* Name field */}
        <div className="mb-2.5">
          <label className="font-sans text-[10px] text-[#999] font-medium mb-1 block">
            Name
          </label>
          <div className="rounded-lg bg-[#2a2a3e] border border-[#3a3a4e] px-3 py-1.5">
            <span className="font-sans text-[11px] text-[#e8e8e8]">
              client proposal skill
            </span>
          </div>
        </div>

        {/* Instructions field */}
        <div className="mb-2.5">
          <label className="font-sans text-[10px] text-[#999] font-medium mb-1 block">
            Instructions
          </label>
          <div className="rounded-lg bg-[#2a2a3e] border-2 border-[#4a4ad4] px-3 py-2 max-h-[100px] overflow-hidden relative">
            <div className="font-mono text-[10px] text-[#ccc] leading-relaxed space-y-0.5">
              <div className="text-[#888]">---</div>
              <div>
                <span className="text-[#888]">name:</span> Client Proposal Skill
              </div>
              <div>
                <span className="text-[#888]">description:</span> Generate complete,
                professional client proposals&hellip;
              </div>
              <div>
                <span className="text-[#888]">trigger:</span> User mentions
                &quot;proposal,&quot; &quot;quote&quot;&hellip;
              </div>
              <div className="text-[#888]">---</div>
              <div className="text-[#888]"># Client Proposal Skill</div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#2a2a3e]" />
          </div>
        </div>

        {/* Knowledge section */}
        <div>
          <label className="font-sans text-[10px] text-[#999] font-medium mb-1.5 block">
            Knowledge
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              "pricing-frameworks",
              "scope-templates",
              "strategy-consulting",
              "objection-handlers",
            ].map((file) => (
              <div
                key={file}
                className="bg-[#2a2a3e] border border-[#3a3a4e] rounded-lg px-2.5 py-1.5"
              >
                <div className="font-sans text-[10px] text-[#e8e8e8] truncate">
                  {file}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[#e85d3a] text-[8px]">&lt;&gt;</span>
                  <span className="font-mono text-[9px] text-[#999]">MD</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3a3a4e]">
        Step 3&ndash;4: Paste SKILL.md, drag in reference files
      </div>
    </div>
  );
}
