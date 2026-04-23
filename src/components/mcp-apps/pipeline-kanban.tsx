const cols = [
  {
    stage: "Lead",
    color: "#b8ae9b",
    deals: [
      { name: "Acme Bakery", value: 18000, contact: "Sarah M." },
      { name: "Nordic Supply", value: 6500, contact: "Jan P." },
    ],
  },
  {
    stage: "Proposal",
    color: "#d65a2f",
    deals: [
      { name: "M\u00fcller Dental", value: 12000, contact: "Anja K." },
      { name: "Kreuz Studio", value: 22000, contact: "Tom F." },
    ],
  },
  {
    stage: "Negotiation",
    color: "#c79838",
    deals: [{ name: "Helix GmbH", value: 45000, contact: "Paul L." }],
  },
  {
    stage: "Won",
    color: "#3b7a3b",
    deals: [{ name: "BerlinBrew", value: 9500, contact: "Mira S." }],
  },
];

export function PipelineKanban({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {cols.map((c) => (
        <div
          key={c.stage}
          className="bg-white border border-ks-hair rounded-md p-2"
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-[5px]">
              <span
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: c.color }}
              />
              <span className="font-mono text-[10px] font-semibold tracking-wide">
                {c.stage.toUpperCase()}
              </span>
            </div>
            <span className="font-mono text-[9px] text-ks-muted">
              {c.deals.length}
            </span>
          </div>
          {c.deals.map((d, i) => (
            <div key={i} className="bg-ks-paper-warm p-[7px] rounded mb-[5px]">
              <div className="font-sans text-[11px] font-semibold">
                {d.name}
              </div>
              {!compact && (
                <div className="font-sans text-[9px] text-ks-muted mt-px">
                  {d.contact}
                </div>
              )}
              <div className="font-mono text-[10px] text-ks-accent mt-[3px]">
                &euro;{d.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
