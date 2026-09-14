import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { BasketView } from "./View";

export default defineView({
  slug: "basket",
  name: "Warenkorb",
  description: "zeigt den Warenkorb mit Zwischensumme, Friends-Punkten und Abholung",
  loader,
  component: BasketView,
  height: 520,
  placeholder: {
    lines: [
      {
        productId: "1002584001",
        qty: 1,
        unitPrice: 15.49,
        lineTotal: 15.49,
        name: "Royal Canin Yorkshire Terrier Adult",
        image:
          "https://media.os.fressnapf.com/products-v2/8/3/7/9/8379816f9c56257e2d2f18e92049b2922bd32b00_2217708__3_.jpg",
      },
      {
        productId: "1230940",
        qty: 1,
        unitPrice: 2.49,
        lineTotal: 2.49,
        name: "Select Gold Sensitive Dental Snacks Mini Adult",
        image:
          "https://media.os.fressnapf.com/products-v2/f/7/0/8/f708c03ad682b65f64d6e7ccef78d1285ad6de14_cd38213dbef9114b0854eee165c051d6536f6613.jpg",
      },
    ],
    itemCount: 2,
    subtotal: 17.98,
    friendsPoints: 17,
    store: { name: "Fressnapf Krefeld", address: "Hafelsstraße 250, 47809 Krefeld" },
    pickupWindow: "heute ab 16:00",
  },
});
