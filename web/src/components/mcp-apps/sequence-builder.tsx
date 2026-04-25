const emails = [
  { day: 0, subj: "Quick question, Sarah", status: "sent" },
  { day: 3, subj: "Following up on my note", status: "sent" },
  { day: 7, subj: "One last thing \u2192", status: "scheduled" },
];

export function SequenceBuilder() {
  return (
    <div>
      <div className="flex justify-between items-center mb-2.5">
        <div className="font-sans text-xs font-semibold">
          Agency New Biz &middot; Warm intro style
        </div>
        <span className="ks-chip !text-[9px]">3 emails &middot; 7 days</span>
      </div>
      {emails.map((e, i) => (
        <div
          key={i}
          className="grid grid-cols-[40px_1fr_70px] gap-2.5 p-2 border border-ks-hair rounded-md mb-1.5 bg-white"
        >
          <div className="font-serif text-lg text-ks-accent italic">
            +{e.day}d
          </div>
          <div>
            <div className="font-sans text-[11px] font-semibold">{e.subj}</div>
            <div className="font-mono text-[9px] text-ks-muted mt-0.5">
              personalization: hometown &middot; role &middot; recent-post
            </div>
          </div>
          <div className="self-center">
            <span
              className="ks-chip !text-[8px] !py-px !px-1.5"
              style={{
                color: e.status === "sent" ? "#3b7a3b" : undefined,
              }}
            >
              {e.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
