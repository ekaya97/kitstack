const data = [
  {
    date: "04/12",
    desc: "Adobe Creative Cloud",
    amt: 59.99,
    vat: 19,
    cat: "Software",
    skr: "6815",
  },
  {
    date: "04/10",
    desc: "DB \u2014 Berlin\u2192Munich",
    amt: 142.0,
    vat: 7,
    cat: "Travel",
    skr: "6720",
  },
  {
    date: "04/08",
    desc: "Hotel Ibis Munich",
    amt: 189.0,
    vat: 7,
    cat: "Travel",
    skr: "6720",
  },
  {
    date: "04/05",
    desc: "Restaurant w/ client",
    amt: 87.5,
    vat: 19,
    cat: "Bewirtung (70%)",
    skr: "6640",
    flag: true,
  },
  {
    date: "04/02",
    desc: "Office supplies",
    amt: 34.2,
    vat: 19,
    cat: "B\u00fcromaterial",
    skr: "6815",
  },
];

const vatColor: Record<number, string> = {
  0: "#b8ae9b",
  7: "#c79838",
  19: "#d65a2f",
};

export function ExpenseTable({ rows = 5 }: { rows?: number }) {
  const items = data.slice(0, rows);
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[60px_1fr_70px_60px_120px] gap-2 px-1 py-1.5 border-b-[1.5px] border-ks-ink min-w-[430px]">
        {["Date", "Description", "Amount", "VAT", "Category"].map((h) => (
          <div
            key={h}
            className="font-mono text-[9px] font-semibold text-ks-muted tracking-wide"
          >
            {h.toUpperCase()}
          </div>
        ))}
      </div>
      {items.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-[60px_1fr_70px_60px_120px] gap-2 px-1 py-[7px] border-b border-dashed border-ks-hair items-center min-w-[430px]"
        >
          <div className="font-mono text-[10px] text-ks-muted">{r.date}</div>
          <div className="font-sans text-[11px]">
            {r.desc}{" "}
            {r.flag && (
              <span className="text-ks-accent text-[10px]">&#9873;</span>
            )}
          </div>
          <div className="font-mono text-[10.5px] text-right">
            &euro;{r.amt.toFixed(2)}
          </div>
          <div>
            <span
              className="ks-chip !text-[9px] !py-px !px-1.5"
              style={{
                borderColor: (vatColor[r.vat] || "#b8ae9b") + "66",
                color: vatColor[r.vat] || "#b8ae9b",
              }}
            >
              {r.vat}%
            </span>
          </div>
          <div className="font-sans text-[10.5px] text-ks-ink2">
            {r.cat}{" "}
            <span className="font-mono text-[9px] text-ks-faint">
              &middot; {r.skr}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
