export function ChatGPTUploadFiles() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#212121]">
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[12px] text-[#ececec] font-medium">
              Knowledge
            </span>
            <span className="font-sans text-[9px] text-[#8e8ea0] bg-[#2f2f2f] px-1.5 py-0.5 rounded">
              6 files
            </span>
          </div>
          <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2f2f2f] border border-[#353535]">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-[#ececec]">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="font-sans text-[10px] text-[#ececec]">
              Upload files
            </span>
          </button>
        </div>

        {/* File list */}
        <div className="space-y-1">
          <FileRow name="SKILL.md" size="12 KB" primary />
          <div className="pl-2 border-l-2 border-[#353535] ml-1 space-y-1">
            <div className="font-mono text-[9px] text-[#8e8ea0] tracking-wider pl-2 py-0.5">
              REFERENCES
            </div>
            <FileRow name="pricing-frameworks.md" size="4 KB" />
            <FileRow name="scope-templates.md" size="6 KB" />
            <FileRow name="objection-handlers.md" size="3 KB" />
          </div>
          <div className="pl-2 border-l-2 border-[#353535] ml-1 space-y-1">
            <div className="font-mono text-[9px] text-[#8e8ea0] tracking-wider pl-2 py-0.5">
              EXAMPLES
            </div>
            <FileRow name="strategy-consulting.md" size="2 KB" />
            <FileRow name="design-agency.md" size="2 KB" />
          </div>
        </div>

        {/* Capabilities toggles */}
        <div className="mt-3 pt-3 border-t border-[#353535]">
          <div className="font-sans text-[10px] text-[#8e8ea0] font-medium mb-2">
            Capabilities
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Web Browsing", on: false },
              { label: "Code Interpreter", on: false },
              { label: "DALL-E", on: false },
            ].map((cap) => (
              <div key={cap.label} className="flex items-center justify-between">
                <span className="font-sans text-[10px] text-[#ececec]">
                  {cap.label}
                </span>
                <div className={`w-7 h-4 rounded-full flex items-center px-0.5 ${cap.on ? "bg-[#10a37f] justify-end" : "bg-[#353535] justify-start"}`}>
                  <div className="w-3 h-3 rounded-full bg-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#353535]">
        Step 3: Upload SKILL.md and all reference files
      </div>
    </div>
  );
}

function FileRow({ name, size, primary = false }: { name: string; size: string; primary?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#2f2f2f] border border-[#353535]">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={primary ? "text-[#10a37f] shrink-0" : "text-[#8e8ea0] shrink-0"}>
        <path
          d="M4.5 1.5h5l4 4v9a1 1 0 01-1 1h-8a1 1 0 01-1-1v-12a1 1 0 011-1z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path d="M9.5 1.5v4h4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className={`font-sans text-[10.5px] truncate ${primary ? "text-[#ececec] font-medium" : "text-[#ececec]"}`}>
        {name}
      </span>
      <span className="font-mono text-[9px] text-[#8e8ea0] ml-auto shrink-0">
        {size}
      </span>
    </div>
  );
}
