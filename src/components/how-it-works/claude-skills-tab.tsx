export function ClaudeSkillsTab() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#2a2a2a]">
      <div className="flex">
        {/* Left: Customize nav */}
        <div className="w-[120px] border-r border-[#3d3d3d] px-3 py-3 space-y-0.5 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#999]">
              <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="font-sans text-[11px] text-[#e8e8e8] font-medium">
              Customize
            </span>
          </div>

          {/* Skills - active */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#3d3d3d]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-white shrink-0">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="font-sans text-[11px] text-white font-medium">
              Skills
            </span>
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5 rounded">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#999] shrink-0">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="font-sans text-[11px] text-[#999]">
              Connectors
            </span>
          </div>
        </div>

        {/* Right: Skills content */}
        <div className="flex-1 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="font-sans text-[13px] text-[#e8e8e8] font-medium">
              Skills
            </span>
            <button className="flex items-center gap-1 px-2 py-1 rounded bg-[#3d3d3d] hover:bg-[#4d4d4d]">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-[#e8e8e8]">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="font-sans text-[11px] text-[#e8e8e8]">
                Add skill
              </span>
            </button>
          </div>

          {/* Skill entry */}
          <div className="bg-[#363636] rounded-lg p-3 border border-[#4d4d4d]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-ks-accent/20 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-ks-accent">
                  <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <div>
                <div className="font-sans text-[12px] text-[#e8e8e8] font-medium">
                  Proposal Skill
                </div>
                <div className="font-sans text-[10px] text-[#888]">
                  3 files &middot; Active
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="font-sans text-[10px] text-green-400">On</span>
              </div>
            </div>
          </div>

          <div className="mt-2 text-center">
            <span className="font-sans text-[10px] text-[#666]">
              Upload a .zip to add a new skill
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3d3d3d]">
        Step 3&ndash;4: Upload the .zip in the Skills tab
      </div>
    </div>
  );
}
