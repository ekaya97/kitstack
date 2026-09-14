import { useState } from "react";
import { useKit } from "@kitstackco/sdk/view";
import { Stars, Chip, Prototyp, eur } from "../shared";

type Product = {
  id: string;
  name: string;
  brand: string;
  price: { amount: number; currency: string; perKg: number | null };
  image: string;
  rating: { value: number; count: number } | null;
  badges: string[];
  attributes: {
    breedSize: string | null;
    lifeStage: string | null;
    grainFree: boolean;
  };
};
type Data = { label: string; products: Product[] };

const CAP: Record<string, string> = {
  klein: "Kleine Rassen",
  mittel: "Mittlere Rassen",
  groß: "Große Rassen",
  welpe: "Welpe",
  adult: "Adult",
  senior: "Senior",
};

function attrChips(a: Product["attributes"]): string[] {
  const out: string[] = [];
  if (a.breedSize) out.push(CAP[a.breedSize] ?? a.breedSize);
  if (a.lifeStage) out.push(CAP[a.lifeStage] ?? a.lifeStage);
  if (a.grainFree) out.push("Getreidefrei");
  return out;
}

function Card({ p }: { p: Product }) {
  const { callTool, reload } = useKit<Data>();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const addToBasket = async () => {
    setBusy(true);
    try {
      await callTool("basket_add", { product_id: p.id, qty: 1 });
      setAdded(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-ks-hair bg-ks-paper">
      <div className="relative aspect-square bg-white p-3">
        <img src={p.image} alt={p.name} className="h-full w-full object-contain" />
        {p.badges[0] && (
          <span className="absolute left-2 top-2">
            <Chip tone={p.badges[0].toLowerCase().includes("angebot") ? "sale" : "accent"}>
              {p.badges[0]}
            </Chip>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-ks-faint">{p.brand}</div>
        <div className="line-clamp-2 text-sm font-medium leading-snug text-ks-ink">{p.name}</div>
        {p.rating && <Stars value={p.rating.value} count={p.rating.count} />}
        <div className="mt-0.5 flex flex-wrap gap-1">
          {attrChips(p.attributes).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        <div className="mt-auto pt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold text-ks-ink">{eur(p.price.amount)}</span>
            {p.price.perKg && (
              <span className="text-[11px] text-ks-faint">{eur(p.price.perKg)}/kg</span>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => callTool("get_product", { id: p.id })}
              className="flex-1 rounded-lg border border-ks-hair px-2 py-1.5 text-[13px] font-medium text-ks-ink2 hover:bg-ks-paper-warm"
            >
              Details
            </button>
            <button
              onClick={addToBasket}
              disabled={busy}
              className="flex-1 rounded-lg bg-ks-accent px-2 py-1.5 text-[13px] font-medium text-white hover:bg-ks-accent-deep disabled:opacity-60"
            >
              {added ? "✓ Im Korb" : "In den Korb"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductListView() {
  const { data } = useKit<Data>();
  const products = data?.products ?? [];

  return (
    <div className="p-4">
      {data?.label && (
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-sm font-medium text-ks-muted">
            <span className="text-ks-ink">{products.length}</span> Treffer · {data.label}
          </h1>
          <span className="font-mono text-[10px] tracking-wider text-ks-faint">FRESSNAPF</span>
        </div>
      )}
      {products.length === 0 ? (
        <div className="py-8 text-center text-sm text-ks-muted">Noch keine Suche.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </div>
      )}
      <Prototyp />
    </div>
  );
}
