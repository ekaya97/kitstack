export const dynamic = "force-dynamic";
import { getAllKitCards } from "@/services/kit.service";
import { PricingClient } from "./pricing-client";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const kits = await getAllKitCards();
  return <PricingClient kits={kits} />;
}
