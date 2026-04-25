export function ClaudeCustomizeSidebar() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#2a2a2a]">
      <div className="px-4 py-3 space-y-0.5">
        {/* Claude sidebar items */}
        {[
          { icon: "plus", label: "New chat" },
          { icon: "search", label: "Search" },
          { icon: "chats", label: "Chats" },
          { icon: "projects", label: "Projects" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded"
          >
            <SidebarIcon name={item.icon} />
            <span className="font-sans text-[12px] text-[#e8e8e8]">
              {item.label}
            </span>
          </div>
        ))}

        {/* Customize - highlighted */}
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded bg-[#3d3d3d]">
          <SidebarIcon name="customize" />
          <span className="font-sans text-[12px] text-white font-medium">
            Customize
          </span>
        </div>

        {[
          { icon: "design", label: "Design" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded"
          >
            <SidebarIcon name={item.icon} />
            <span className="font-sans text-[12px] text-[#e8e8e8]">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3d3d3d]">
        Step 2: Click Customize in Claude&apos;s sidebar
      </div>
    </div>
  );
}

function SidebarIcon({ name }: { name: string }) {
  const cls = "text-[#999] shrink-0";
  switch (name) {
    case "plus":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "search":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "chats":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
          <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 3V3z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "projects":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
          <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 6h12" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "customize":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-white shrink-0">
          <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "design":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    default:
      return <div className="w-[14px] h-[14px]" />;
  }
}
