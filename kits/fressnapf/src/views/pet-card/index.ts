import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { PetCardView } from "./View";

export default defineView({
  slug: "pet-card",
  name: "Tierprofil",
  description: "zeigt das gespeicherte Tierprofil (Name, Rasse, Alter, Bedürfnisse)",
  loader,
  component: PetCardView,
  height: 180,
  placeholder: {
    name: "Bruno",
    species: "hund",
    breed: "Scottish Terrier",
    ageYears: 4,
    weightKg: null,
    needs: ["Zahnpflege", "kleine Rassen"],
  },
});
