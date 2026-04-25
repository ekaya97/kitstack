const actions = [
  {
    done: true,
    desc: "Send proposal draft",
    owner: "You",
    due: "Apr 15",
    meeting: "Acme intro",
    overdue: false,
  },
  {
    done: false,
    desc: "Review Q2 budget allocation",
    owner: "Lena",
    due: "Apr 20",
    meeting: "Strategy sync",
    overdue: false,
  },
  {
    done: false,
    desc: "Book production photographer",
    owner: "You",
    due: "Apr 22",
    meeting: "Acme intro",
    overdue: false,
  },
  {
    done: false,
    desc: "Confirm packaging specs w/ supplier",
    owner: "Marco",
    due: "Apr 18",
    meeting: "Kick-off",
    overdue: true,
  },
];

export function ActionTracker() {
  return (
    <div>
      <div className="flex gap-2 mb-2.5">
        <span className="ks-chip ks-chip-solid !text-[10px]">
          All &middot; 4
        </span>
        <span className="ks-chip !text-[10px]">Mine &middot; 2</span>
        <span className="ks-chip !text-[10px] !text-ks-accent !border-ks-accent">
          Overdue &middot; 1
        </span>
      </div>
      {actions.map((a, i) => (
        <div
          key={i}
          className="grid grid-cols-[18px_1fr_70px_70px] gap-2.5 px-1.5 py-2 border-b border-dashed border-ks-hair items-center"
        >
          <div
            className="w-3.5 h-3.5 rounded-[3px] grid place-items-center text-[10px] text-white"
            style={{
              border: `1.5px solid ${a.done ? "#3b7a3b" : "#d9ceb8"}`,
              background: a.done ? "#3b7a3b" : "#fff",
            }}
          >
            {a.done && "\u2713"}
          </div>
          <div>
            <div
              className={`font-sans text-[11.5px] ${a.done ? "line-through text-ks-muted" : "text-ks-ink"}`}
            >
              {a.desc}
            </div>
            <div className="font-mono text-[9px] text-ks-faint mt-px">
              from &quot;{a.meeting}&quot;
            </div>
          </div>
          <div className="font-sans text-[10px] text-ks-muted">{a.owner}</div>
          <div
            className="font-mono text-[10px]"
            style={{
              color: a.overdue ? "#d65a2f" : undefined,
              fontWeight: a.overdue ? 600 : 400,
            }}
          >
            {a.overdue && "\u2691 "}
            {a.due}
          </div>
        </div>
      ))}
    </div>
  );
}
