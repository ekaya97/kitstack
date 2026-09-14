import type { InferSelectModel } from "drizzle-orm";
import type { basketLines } from "../schema";
import { friendsPoints, MOCK_STORE, PICKUP_WINDOW, type Store } from "./store";

export type BasketLineRow = InferSelectModel<typeof basketLines>;

export type BasketLine = {
  productId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  name: string;
  image: string;
};

export type Basket = {
  lines: BasketLine[];
  itemCount: number;
  subtotal: number;
  friendsPoints: number;
  store: Store;
  pickupWindow: string;
};

export function buildBasket(rows: BasketLineRow[]): Basket {
  const lines: BasketLine[] = rows.map((r) => ({
    productId: r.productId,
    qty: r.qty,
    unitPrice: r.unitPrice,
    lineTotal: Math.round(r.unitPrice * r.qty * 100) / 100,
    name: r.name,
    image: r.image,
  }));
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
    subtotal,
    friendsPoints: friendsPoints(subtotal),
    store: { ...MOCK_STORE },
    pickupWindow: PICKUP_WINDOW,
  };
}

export const eur = (n: number): string =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
