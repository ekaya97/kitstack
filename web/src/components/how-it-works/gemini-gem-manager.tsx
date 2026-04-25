export function GeminiGemManager() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-[#1a1a2e]">
      <div className="px-4 py-3">
        <h3 className="font-sans text-[14px] text-[#e8e8e8] font-medium mb-3">
          Gem manager
        </h3>

        {/* Pre-made section */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-sans text-[11px] text-[#999]">
              Pre-made by Google
            </span>
            <span className="font-sans text-[10px] text-[#888]">
              Show more
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { icon: "chess", name: "Chess champ", color: "#e8a040" },
              { icon: "book", name: "Storybook", color: "#4caf50" },
              { icon: "bulb", name: "Brainstormer", color: "#e8a040" },
            ].map((gem) => (
              <div
                key={gem.name}
                className="bg-[#2a2a3e] rounded-lg p-2.5 border border-[#3a3a4e]"
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center mb-1.5"
                  style={{ background: gem.color + "33" }}
                >
                  <span style={{ color: gem.color }} className="text-[10px]">
                    {gem.icon === "chess" ? "\u265A" : gem.icon === "book" ? "\u25A3" : "\u2726"}
                  </span>
                </div>
                <div className="font-sans text-[10px] text-[#e8e8e8] font-medium">
                  {gem.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Gems section */}
        <div className="flex items-center justify-between">
          <span className="font-sans text-[11px] text-[#999]">My Gems</span>
          {/* New Gem button - highlighted */}
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#4a4ad4] text-white">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <span className="font-sans text-[10px] font-medium">New Gem</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-[#3a3a4e]">
        Step 2: Open Gems, click + New Gem
      </div>
    </div>
  );
}
