import { useState } from "react";
import { useKit } from "@kitstackco/sdk/view";
import { Stars, Chip, Prototyp, eur } from "../shared";

type Review = {
  rating: number;
  title: string | null;
  text: string;
  date: string;
  author: string | null;
};
type Product = {
  id: string;
  name: string;
  brand: string;
  price: { amount: number; currency: string; perKg: number | null };
  image: string;
  rating: { value: number; count: number } | null;
  badges: string[];
  bullets: string[];
  composition: string | null;
  analytics: string | null;
};
type Data = { product: Product; reviews: Review[] } | null;

export function ProductDetailView() {
  const { data, callTool } = useKit<Data>();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openComp, setOpenComp] = useState(false);

  if (!data) return <div className="p-4 text-sm text-ks-muted">Kein Produkt ausgewählt.</div>;
  const { product: p, reviews } = data;

  const add = async () => {
    setBusy(true);
    try {
      await callTool("basket_add", { product_id: p.id, qty: 1 });
      setAdded(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      <div className="rounded-2xl border border-ks-hair bg-ks-paper p-4">
        <div className="flex gap-4">
          <div className="h-28 w-28 shrink-0 rounded-xl bg-white p-2">
            <img src={p.image} alt={p.name} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ks-faint">
              {p.brand}
            </div>
            <h1 className="text-lg font-semibold leading-tight text-ks-ink">{p.name}</h1>
            <div className="mt-1">{p.rating && <Stars value={p.rating.value} count={p.rating.count} />}</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-ks-ink">{eur(p.price.amount)}</span>
              {p.price.perKg && <span className="text-xs text-ks-faint">{eur(p.price.perKg)}/kg</span>}
            </div>
            {p.badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {p.badges.map((b) => (
                  <Chip key={b} tone="accent">
                    {b}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>

        {p.bullets.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {p.bullets.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-ks-ink2">
                <span className="mt-0.5 text-ks-accent">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {p.composition && (
          <div className="mt-3 border-t border-ks-hair pt-3">
            <button
              onClick={() => setOpenComp((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-medium text-ks-ink2"
            >
              Zusammensetzung & Analyse
              <span className="text-ks-faint">{openComp ? "−" : "+"}</span>
            </button>
            {openComp && (
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-ks-muted">
                <p>{p.composition}</p>
                {p.analytics && <p>{p.analytics}</p>}
              </div>
            )}
          </div>
        )}

        <button
          onClick={add}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-ks-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-ks-accent-deep disabled:opacity-60"
        >
          {added ? "✓ Im Warenkorb" : "In den Korb"}
        </button>
      </div>

      {reviews.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ks-faint">
            Bewertungen
          </h2>
          <div className="space-y-2">
            {reviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-ks-hair bg-ks-paper p-3">
                <div className="flex items-center justify-between">
                  <span className="text-ks-star text-[13px] tracking-[-1px]">
                    {"★★★★★".slice(0, r.rating)}
                    <span className="text-ks-hair">{"★★★★★".slice(r.rating)}</span>
                  </span>
                  {r.author && <span className="text-[11px] text-ks-faint">{r.author}</span>}
                </div>
                {r.title && <div className="mt-1 text-sm font-medium text-ks-ink">„{r.title}"</div>}
                <p className="mt-0.5 text-[13px] leading-relaxed text-ks-muted">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Prototyp />
    </div>
  );
}
