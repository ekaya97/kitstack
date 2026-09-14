import { useState } from "react";
import { useKit } from "@kitstackco/sdk/view";
import { Prototyp, eur } from "../shared";

type Line = { productId: string; qty: number; unitPrice: number; lineTotal: number; name: string; image: string };
type Store = { name: string; address: string };
type Data = {
  lines: Line[];
  itemCount: number;
  subtotal: number;
  friendsPoints: number;
  store: Store;
  pickupWindow: string;
};

export function BasketView() {
  const { data, callTool, reload } = useKit<Data>();
  const [ordering, setOrdering] = useState(false);

  if (!data || data.lines.length === 0) {
    return <div className="p-4 text-sm text-ks-muted">Der Warenkorb ist leer.</div>;
  }

  const step = async (l: Line, delta: number) => {
    if (delta < 0 && l.qty <= 1) {
      await callTool("basket_remove", { product_id: l.productId });
    } else {
      await callTool("basket_add", { product_id: l.productId, qty: delta });
    }
    await reload();
  };

  const order = async () => {
    setOrdering(true);
    try {
      await callTool("place_order", {});
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="p-4">
      <div className="rounded-2xl border border-ks-hair bg-ks-paper">
        <div className="flex items-center justify-between border-b border-ks-hair px-4 py-3">
          <h1 className="text-sm font-semibold text-ks-ink">Warenkorb</h1>
          <span className="text-[11px] text-ks-faint">{data.itemCount} Artikel</span>
        </div>

        <div className="divide-y divide-ks-hair">
          {data.lines.map((l) => (
            <div key={l.productId} className="flex items-center gap-3 px-4 py-3">
              <div className="h-12 w-12 shrink-0 rounded-lg bg-white p-1">
                <img src={l.image} alt={l.name} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-medium text-ks-ink">{l.name}</div>
                <div className="text-[12px] text-ks-faint">{eur(l.unitPrice)} / Stück</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => step(l, -1)}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-ks-hair text-ks-muted hover:bg-ks-paper-warm"
                >
                  −
                </button>
                <span className="w-5 text-center text-sm text-ks-ink">{l.qty}</span>
                <button
                  onClick={() => step(l, 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-ks-hair text-ks-muted hover:bg-ks-paper-warm"
                >
                  +
                </button>
              </div>
              <div className="w-16 text-right text-sm font-semibold text-ks-ink">{eur(l.lineTotal)}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-ks-hair px-4 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-ks-muted">Zwischensumme</span>
            <span className="font-semibold text-ks-ink">{eur(data.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ks-muted">Friends-Punkte</span>
            <span className="font-medium text-ks-accent">+{data.friendsPoints}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-ks-hair bg-ks-accent-soft/50 px-4 py-3">
          <span className="text-ks-accent-deep">📍</span>
          <div className="text-[13px] leading-tight text-ks-ink2">
            <div className="font-medium">Abholung: {data.store.name}</div>
            <div className="text-ks-muted">{data.pickupWindow}</div>
          </div>
        </div>
      </div>

      <button
        onClick={order}
        disabled={ordering}
        className="mt-3 w-full rounded-xl bg-ks-accent px-4 py-3 text-sm font-semibold text-white hover:bg-ks-accent-deep disabled:opacity-60"
      >
        {ordering ? "Wird bestellt …" : "Zur Abholung bestellen"}
      </button>
      <Prototyp />
    </div>
  );
}
