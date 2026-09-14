/**
 * Mocked store availability + Friends points. Labelled as simulated in the
 * views' footer ("Prototyp — Verfügbarkeit und Friends-Punkte simuliert").
 * Real availability would come from SAP/EWM; Friends from OAuth — out of scope.
 */
export const MOCK_STORE = {
  id: "fn-krefeld",
  name: "Fressnapf Krefeld",
  address: "Hafelsstraße 250, 47809 Krefeld",
  pickupToday: true,
} as const;

export type Store = {
  id: string;
  name: string;
  address: string;
  pickupToday: boolean;
};

export const PICKUP_WINDOW = "heute ab 16:00";

/** Mock: 1 Friends-Punkt je vollem Euro. */
export function friendsPoints(subtotal: number): number {
  return Math.floor(subtotal);
}
