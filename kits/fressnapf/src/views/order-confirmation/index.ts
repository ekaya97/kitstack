import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { OrderConfirmationView } from "./View";

export default defineView({
  slug: "order-confirmation",
  name: "Bestellbestätigung",
  description: "zeigt die abgeschlossene Abholbestellung — das Schlussbild",
  loader,
  component: OrderConfirmationView,
  height: 560,
  placeholder: {
    id: "FN-2026-004827",
    store: { name: "Fressnapf Krefeld", address: "Hafelsstraße 250, 47809 Krefeld" },
    pickupWindow: "heute ab 16:00",
    subtotal: 17.98,
    friendsPoints: 17,
    lines: [
      {
        name: "Royal Canin Yorkshire Terrier Adult",
        qty: 1,
        lineTotal: 15.49,
        image:
          "https://media.os.fressnapf.com/products-v2/8/3/7/9/8379816f9c56257e2d2f18e92049b2922bd32b00_2217708__3_.jpg",
      },
      {
        name: "Select Gold Sensitive Dental Snacks Mini Adult",
        qty: 1,
        lineTotal: 2.49,
        image:
          "https://media.os.fressnapf.com/products-v2/f/7/0/8/f708c03ad682b65f64d6e7ccef78d1285ad6de14_cd38213dbef9114b0854eee165c051d6536f6613.jpg",
      },
    ],
    petName: "Bruno",
  },
});
