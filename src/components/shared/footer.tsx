import { Logo } from "@/components/ui/logo";

const columns = [
  {
    heading: "Catalogue",
    items: ["Free skills", "Kits", "Pricing", "What's new"],
  },
  {
    heading: "Authors",
    items: ["Browse authors", "Become an author", "Quality guide"],
  },
  {
    heading: "Legal",
    items: ["Impressum", "Privacy", "Terms", "support@kitstack.co"],
  },
];

export function Footer() {
  return (
    <div className="px-12 pt-12 pb-8 border-t border-ks-hair bg-ks-paper-warm">
      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <Logo size={24} />
            <span className="font-serif text-xl">
              kitstack<span className="text-ks-accent">.co</span>
            </span>
          </div>
          <div className="font-sans text-[13px] text-ks-muted leading-relaxed max-w-xs">
            Free skills and subscription kits that turn Claude into a
            specialist. Skills download free. Kits remember everything.
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.heading}>
            <div className="font-sans text-xs font-semibold uppercase tracking-wider mb-2.5">
              {col.heading}
            </div>
            {col.items.map((item) => (
              <div
                key={item}
                className="font-sans text-[13px] text-ks-muted mb-1.5 hover:text-ks-ink cursor-pointer"
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-8 pt-5 border-t border-ks-hair flex justify-between font-mono text-[11px] text-ks-muted">
        <div>&copy; 2026 kitstack &mdash; shipped from Berlin</div>
        <div>VAT handled by Lemon Squeezy &middot; no account required</div>
      </div>
    </div>
  );
}
