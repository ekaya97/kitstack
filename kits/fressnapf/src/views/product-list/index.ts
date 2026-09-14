import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { ProductListView } from "./View";

export default defineView({
  slug: "product-list",
  name: "Produktliste",
  description: "zeigt die Treffer der letzten Suche als Produktkarten",
  loader,
  component: ProductListView,
  height: 560,
  placeholder: {
    label: "klein · adult · trocken",
    products: [
      {
        id: "1002584001",
        name: "Royal Canin Yorkshire Terrier Adult",
        brand: "Royal Canin",
        price: { amount: 15.49, currency: "EUR", perKg: 10.33 },
        image:
          "https://media.os.fressnapf.com/products-v2/8/3/7/9/8379816f9c56257e2d2f18e92049b2922bd32b00_2217708__3_.jpg",
        rating: { value: 4.7, count: 98 },
        badges: ["Rassespezifisch"],
        attributes: { breedSize: "klein", lifeStage: "adult", grainFree: false },
      },
      {
        id: "1003019001",
        name: "Royal Canin Mini Adult",
        brand: "Royal Canin",
        price: { amount: 17.99, currency: "EUR", perKg: 9.0 },
        image:
          "https://media.os.fressnapf.com/products-v2/f/6/5/6/f656cb41fb03f8c1cec29cb34fb532468f367246_1001097001_0.png",
        rating: { value: 4.6, count: 214 },
        badges: ["Bestseller"],
        attributes: { breedSize: "klein", lifeStage: "adult", grainFree: false },
      },
    ],
  },
});
