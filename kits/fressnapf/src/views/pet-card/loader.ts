import { defineLoader } from "@kitstackco/sdk";
import { petProfileGet } from "../../tools/pet-profile-get";

export const loader = defineLoader(async (ctx) => {
  return petProfileGet.load(ctx, {});
});
