import { useKit } from "@kitstackco/sdk/view";
import { Prototyp, eur } from "../shared";

type Line = { name: string; qty: number; lineTotal: number; image: string };
type Data = {
  id: string;
  store: { name: string; address: string };
  pickupWindow: string;
  subtotal: number;
  friendsPoints: number;
  lines: Line[];
  petName: string | null;
} | null;

export function OrderConfirmationView() {
  const { data } = useKit<Data>();
  if (!data) return <div className="p-4 text-sm text-ks-muted">Keine Bestellung.</div>;

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-2xl border border-ks-hair bg-ks-paper">
        <div className="flex flex-col items-center gap-2 bg-ks-accent px-4 py-6 text-center text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">
            ✓
          </div>
          <h1 className="text-lg font-semibold">Zur Abholung bereit</h1>
          <p className="font-mono text-[13px] tracking-wide text-white/90">{data.id}</p>
        </div>

        <div className="flex items-start gap-2 border-b border-ks-hair px-4 py-3">
          <span className="mt-0.5 text-ks-accent-deep">📍</span>
          <div className="text-[13px] leading-tight">
            <div className="font-medium text-ks-ink">{data.store.name}</div>
            <div className="text-ks-muted">{data.store.address}</div>
            <div className="mt-1 font-medium text-ks-accent-deep">Abholung {data.pickupWindow}</div>
          </div>
        </div>

        <div className="divide-y divide-ks-hair">
          {data.lines.map((l, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-white p-1">
                <img src={l.image} alt={l.name} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1 text-[13px]">
                <span className="text-ks-muted">{l.qty}× </span>
                <span className="text-ks-ink">{l.name}</span>
              </div>
              <span className="text-[13px] font-medium text-ks-ink">{eur(l.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-ks-hair px-4 py-3">
          <span className="text-sm text-ks-muted">
            Summe · <span className="text-ks-accent">+{data.friendsPoints} Punkte</span>
          </span>
          <span className="text-base font-semibold text-ks-ink">{eur(data.subtotal)}</span>
        </div>

        <div className="bg-ks-paper-warm px-4 py-3 text-center text-sm font-medium text-ks-ink2">
          {data.petName ? `${data.petName} freut sich. 🐾` : "Ihr Liebling freut sich. 🐾"}
        </div>
      </div>
      <Prototyp />
    </div>
  );
}
