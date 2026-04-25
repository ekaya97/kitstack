export function ChatGPTNewAppModal() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#2a2a2a]">
      <div className="bg-[#1a1a1a] px-4 py-3 flex items-center justify-center">
        <div className="w-full max-w-[320px] bg-[#363636] rounded-xl p-5 border border-[#4d4d4d] shadow-2xl">
          {/* Modal header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-sans text-[14px] text-[#e8e8e8] font-semibold">
                New App
              </span>
              <span className="font-mono text-[9px] text-[#888] bg-[#4d4d4d] px-1.5 py-0.5 rounded">
                BETA
              </span>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[#888]">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="font-sans text-[11px] text-[#ccc] font-medium mb-1 block">
                Name
              </label>
              <div className="rounded-lg border-2 border-ks-accent bg-[#2a2a2a] px-3 py-2">
                <span className="font-sans text-[12px] text-ks-accent font-medium">
                  KitStack
                </span>
              </div>
            </div>

            {/* MCP Server URL */}
            <div>
              <label className="font-sans text-[11px] text-[#ccc] font-medium mb-1 block">
                MCP Server URL
              </label>
              <div className="rounded-lg border border-[#4d4d4d] bg-[#2a2a2a] px-3 py-2">
                <span className="font-mono text-[12px] text-[#e8e8e8]">
                  mcp.kitstack.co
                </span>
              </div>
            </div>

            {/* Authentication */}
            <div>
              <label className="font-sans text-[11px] text-[#ccc] font-medium mb-1 block">
                Authentication
              </label>
              <div className="rounded-lg border border-[#4d4d4d] bg-[#2a2a2a] px-3 py-2 flex items-center justify-between">
                <span className="font-sans text-[12px] text-[#e8e8e8]">
                  OAuth
                </span>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-[#888]">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="mt-3 bg-[#3d2a1a] rounded-lg px-3 py-2 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#e8a040] shrink-0">
              <path d="M8 1l7 13H1L8 1z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 6v3M8 11v1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="font-sans text-[10px] text-[#e8a040]">
              Custom MCP servers introduce risk.
            </span>
          </div>

          {/* Checkbox */}
          <div className="mt-2 flex items-start gap-2">
            <div className="w-3.5 h-3.5 rounded border border-[#4d4d4d] bg-[#2a2a2a] mt-0.5 shrink-0 flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="none" className="text-[#e8e8e8]">
                <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <span className="font-sans text-[10px] text-[#999] leading-relaxed">
              <span className="text-[#e8e8e8] font-medium">I understand and want to continue</span>
            </span>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-4">
            <button className="px-4 py-1.5 rounded-lg bg-ks-accent font-sans text-[12px] text-white font-medium">
              Create
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3d3d3d]">
        Step 4: Enter &quot;KitStack&quot;, paste the MCP URL, select OAuth
      </div>
    </div>
  );
}
