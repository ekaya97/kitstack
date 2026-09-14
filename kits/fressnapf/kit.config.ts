import { defineKit } from "@kitstackco/sdk";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";

// Tools
import { petProfileSet } from "./src/tools/pet-profile-set";
import { petProfileGet } from "./src/tools/pet-profile-get";
import { searchProducts } from "./src/tools/search-products";
import { getProduct } from "./src/tools/get-product";
import { basketAdd } from "./src/tools/basket-add";
import { basketRemove } from "./src/tools/basket-remove";
import { basketGet } from "./src/tools/basket-get";
import { storeAvailability } from "./src/tools/store-availability";
import { placeOrder } from "./src/tools/place-order";

// Views
import petCard from "./src/views/pet-card";
import productList from "./src/views/product-list";
import productDetail from "./src/views/product-detail";
import basket from "./src/views/basket";
import orderConfirmation from "./src/views/order-confirmation";

export default defineKit({
  id: "fressnapf",
  version: "0.1.0",
  name: "Fressnapf",
  description:
    "Einkaufsassistent für Heimtierbedarf auf Basis des Fressnapf-Sortiments. Tierprofil anlegen, passendes Futter und Zahnpflege finden, in den Warenkorb legen und zur Abholung im Markt bestellen. Prototyp — Verfügbarkeit und Friends-Punkte simuliert.",
  schema,
  migrationsDir: "./migrations",
  instructions,
  triggers: [
    "fressnapf",
    "hund",
    "katze",
    "hundefutter",
    "tierbedarf",
    "haustier",
    "futter",
    "tierprofil",
    "warenkorb",
    "abholung",
    "zahnpflege",
  ],
  tools: [
    petProfileSet,
    petProfileGet,
    searchProducts,
    getProduct,
    basketAdd,
    basketRemove,
    basketGet,
    storeAvailability,
    placeOrder,
  ],
  views: [petCard, productList, productDetail, basket, orderConfirmation],
});
