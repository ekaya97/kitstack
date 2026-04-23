import type { Metadata } from "next";
import type { Skill, Kit } from "@/db/schema";

// --- Skills (free downloads) ---

export function generateSkillMetadata(skill: Skill): Metadata {
  return {
    title: `${skill.name} — Free Claude Skill`,
    description: `${skill.description}. Free download — works on ${skill.compatibility.join(", ")}.`,
    openGraph: {
      title: skill.name,
      description: `${skill.description}. Free Claude skill — no signup required.`,
      type: "website",
      url: `https://kitstack.co/skills/${skill.slug}`,
    },
  };
}

export function generateSkillJsonLd(skill: Skill): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: skill.name,
    description: skill.description,
    applicationCategory: "AI Tool",
    operatingSystem: "Claude",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };
}

// --- Kits (subscription products) ---

export function generateKitMetadata(kit: Kit): Metadata {
  return {
    title: `${kit.name} — Replace ${kit.replaces}`,
    description: `${kit.description}. Replaces ${kit.replaces}. Save €${kit.savingsPerMonth}/mo. Part of KitStack Starter at €5/mo.`,
    openGraph: {
      title: kit.name,
      description: `${kit.description}. Replaces ${kit.replaces}. Save €${kit.savingsPerMonth}/mo.`,
      type: "website",
      url: `https://kitstack.co/kits/${kit.slug}`,
    },
  };
}

export function generateKitJsonLd(kit: Kit): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: kit.name,
    description: kit.description,
    category: kit.category,
    url: `https://kitstack.co/kits/${kit.slug}`,
    offers: {
      "@type": "Offer",
      price: "5.00",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };
}
