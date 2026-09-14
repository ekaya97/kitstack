import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { ProductDetailView } from "./View";

export default defineView({
  slug: "product-detail",
  name: "Produktdetails",
  description: "zeigt ein Produkt mit Details, Zusammensetzung und Bewertungen",
  loader,
  component: ProductDetailView,
  height: 620,
  placeholder: {
    product: {
      id: "1230940",
      name: "Select Gold Sensitive Dental Snacks Mini Adult",
      brand: "Select Gold",
      price: { amount: 2.49, currency: "EUR", perKg: null },
      image:
        "https://media.os.fressnapf.com/products-v2/f/7/0/8/f708c03ad682b65f64d6e7ccef78d1285ad6de14_cd38213dbef9114b0854eee165c051d6536f6613.jpg",
      rating: { value: 4.7, count: 156 },
      badges: ["Zahnpflege"],
      bullets: ["Reduziert Zahnbelag & Zahnstein", "Für kleine Rassen", "Getreidearm, gut verträglich"],
      composition: "Kartoffelstärke, pflanzliche Nebenerzeugnisse, Zellulose, Mineralstoffe.",
      analytics: "Protein 8 %, Fettgehalt 2 %, Rohfaser 3 %, Rohasche 5 %.",
    },
    reviews: [
      {
        rating: 5,
        title: "Bruno liebt sie",
        text: "Endlich ein Zahnpflege-Snack, den mein Terrier freiwillig nimmt.",
        date: "2026-07-14",
        author: "Sandra K.",
      },
    ],
  },
});
