export function ClaudeAddConnectorModal() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#2a2a2a]">
      {/* Dimmed background hint */}
      <div className="bg-[#1a1a1a] px-4 py-3 flex items-center justify-center">
        <div className="w-full max-w-[320px] bg-[#363636] rounded-xl p-5 border border-[#4d4d4d] shadow-2xl">
          {/* Modal header */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-sans text-[14px] text-[#e8e8e8] font-semibold">
                Add custom connector
              </span>
              <span className="font-mono text-[9px] text-[#888] bg-[#4d4d4d] px-1.5 py-0.5 rounded">
                BETA
              </span>
            </div>
            <p className="font-sans text-[11px] text-[#888] leading-relaxed">
              Connect Claude to your data and tools.
            </p>
          </div>

          {/* Form fields */}
          <div className="space-y-2 mb-3">
            <div className="rounded-lg border-2 border-ks-accent bg-[#2a2a2a] px-3 py-2">
              <span className="font-sans text-[12px] text-ks-accent font-medium">
                KitStack
              </span>
            </div>
            <div className="rounded-lg border border-[#4d4d4d] bg-[#2a2a2a] px-3 py-2">
              <span className="font-mono text-[12px] text-[#e8e8e8]">
                mcp.kitstack.co
              </span>
            </div>
          </div>

          {/* Advanced settings */}
          <div className="flex items-center gap-1 mb-4">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-[#888]">
              <path d="M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="font-sans text-[11px] text-[#888]">
              Advanced settings
            </span>
          </div>

          {/* Disclaimer */}
          <p className="font-sans text-[10px] text-[#666] leading-relaxed mb-4">
            Only use connectors from developers you trust.
          </p>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-[#4d4d4d] font-sans text-[12px] text-[#ccc]">
              Cancel
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-ks-accent font-sans text-[12px] text-white font-medium">
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3d3d3d]">
        Step 4: Enter &quot;KitStack&quot; and paste mcp.kitstack.co
      </div>
    </div>
  );
}
