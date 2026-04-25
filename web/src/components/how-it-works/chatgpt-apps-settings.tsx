export function ChatGPTAppsSettings() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#2a2a2a]">
      <div className="flex">
        {/* Left: Settings nav */}
        <div className="w-[130px] border-r border-[#3d3d3d] px-2 py-3 space-y-0.5 shrink-0">
          {[
            { label: "General", icon: "gear", active: false },
            { label: "Notifications", icon: "bell", active: false },
            { label: "Personalization", icon: "person", active: false },
            { label: "Apps", icon: "apps", active: true },
            { label: "Data controls", icon: "data", active: false },
            { label: "Security", icon: "shield", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-sans ${
                item.active
                  ? "bg-[#3d3d3d] text-white font-medium"
                  : "text-[#ccc]"
              }`}
            >
              <SettingsIcon name={item.icon} active={item.active} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Right: Apps content */}
        <div className="flex-1 px-5 py-4">
          <div className="text-center mb-4">
            {/* App icons cluster */}
            <div className="flex justify-center gap-[-4px] mb-2">
              {["#10a37f", "#f5a623", "#e85d3a", "#4caf50"].map((c, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-[#2a2a2a] flex items-center justify-center -ml-1 first:ml-0"
                  style={{ background: c }}
                >
                  <span className="text-white text-[8px] font-bold">
                    {["C", "G", "D", "M"][i]}
                  </span>
                </div>
              ))}
            </div>
            <p className="font-sans text-[11px] text-[#999] leading-relaxed">
              Add and manage apps ChatGPT can use in your chats.
            </p>
            <button className="mt-2 px-3 py-1.5 rounded-lg border border-[#4d4d4d] font-sans text-[11px] text-[#e8e8e8]">
              Explore apps
            </button>
          </div>

          {/* Advanced settings - highlighted */}
          <div className="border-t border-[#3d3d3d] pt-3 mt-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[#999]">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span className="font-sans text-[12px] text-[#e8e8e8]">
                  Advanced settings
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-[#3d3d3d] font-sans text-[11px] text-[#e8e8e8] ring-1 ring-ks-accent">
                  Create app
                </span>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-[#999]">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3d3d3d]">
        Step 2&ndash;3: Open Apps, enable Developer mode, click Create app
      </div>
    </div>
  );
}

function SettingsIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "#fff" : "#999";
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0" style={{ color }}>
      {name === "gear" && (
        <>
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2.5" />
        </>
      )}
      {name === "bell" && (
        <path d="M4 7a4 4 0 018 0v2l1.5 2H2.5L4 9V7zM6 12h4" stroke="currentColor" strokeWidth="1.2" />
      )}
      {name === "person" && (
        <>
          <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
      {name === "apps" && (
        <>
          <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
      {name === "data" && (
        <>
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 7h12M6 7v6" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
      {name === "shield" && (
        <path d="M8 1.5L2.5 4v4c0 3.5 2.5 6 5.5 7 3-1 5.5-3.5 5.5-7V4L8 1.5z" stroke="currentColor" strokeWidth="1.2" />
      )}
    </svg>
  );
}
