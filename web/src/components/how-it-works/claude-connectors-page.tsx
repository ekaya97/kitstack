export function ClaudeConnectorsPage() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#2a2a2a]">
      <div className="flex">
        {/* Left: Customize nav */}
        <div className="hidden sm:block w-[120px] border-r border-[#3d3d3d] px-3 py-3 space-y-0.5 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#999]">
              <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="font-sans text-[11px] text-[#e8e8e8] font-medium">
              Customize
            </span>
          </div>

          <div className="flex items-center gap-2 px-2 py-1.5 rounded">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#999] shrink-0">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="font-sans text-[11px] text-[#999]">
              Skills
            </span>
          </div>

          {/* Connectors - active */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#3d3d3d]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-white shrink-0">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="font-sans text-[11px] text-white font-medium">
              Connectors
            </span>
          </div>
        </div>

        {/* Right: Connectors content */}
        <div className="flex-1 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="font-sans text-[13px] text-[#e8e8e8] font-medium">
              Connectors
            </span>
            <div className="flex items-center gap-1.5">
              <button className="w-6 h-6 rounded bg-[#3d3d3d] flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-[#e8e8e8]">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>
              {/* Plus button - highlighted */}
              <div className="relative">
                <button className="w-6 h-6 rounded bg-[#3d3d3d] flex items-center justify-center ring-2 ring-ks-accent">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-[#e8e8e8]">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
                {/* Dropdown */}
                <div className="absolute right-0 top-8 w-[160px] max-w-[90vw] bg-[#363636] border border-[#4d4d4d] rounded-lg py-1 shadow-lg z-10">
                  <div className="px-3 py-1.5 flex items-center gap-2">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-[#999]">
                      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    <span className="font-sans text-[11px] text-[#ccc]">
                      Browse connectors
                    </span>
                  </div>
                  <div className="px-3 py-1.5 flex items-center gap-2 bg-[#4d4d4d]">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-[#e8e8e8]">
                      <circle cx="4" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
                    </svg>
                    <span className="font-sans text-[11px] text-white font-medium">
                      Add custom connector
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connected section */}
          <div className="mb-2">
            <div className="font-sans text-[10px] text-[#888] mb-1.5 tracking-wide">
              Web
            </div>
            <div className="space-y-1">
              <ConnectorRow name="Apollo.io" color="#6b5ce7" letter="A" />
              <ConnectorRow name="Clay" color="#e85d3a" letter="C" />
            </div>
          </div>

          <div>
            <div className="font-sans text-[10px] text-[#888] mb-1.5 tracking-wide">
              Not connected
            </div>
            <div className="space-y-1">
              <ConnectorRow name="Gmail" color="#ea4335" letter="M" dim />
              <ConnectorRow name="Google Drive" color="#4285f4" letter="G" dim />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3d3d3d]">
        Step 3: Click + &rarr; Add custom connector
      </div>
    </div>
  );
}

function ConnectorRow({
  name,
  color,
  letter,
  dim = false,
}: {
  name: string;
  color: string;
  letter: string;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded">
      <div
        className="w-5 h-5 rounded flex items-center justify-center shrink-0"
        style={{ background: color, opacity: dim ? 0.5 : 1 }}
      >
        <span className="text-white font-sans text-[10px] font-bold">
          {letter}
        </span>
      </div>
      <span
        className="font-sans text-[11px]"
        style={{ color: dim ? "#888" : "#e8e8e8" }}
      >
        {name}
      </span>
    </div>
  );
}
