import type { PhotoboothModel, Option, V1ModelSlug } from "@/types";
import { V1_MODEL_SLUGS } from "@/types";

const MODEL_META: Record<
  V1ModelSlug,
  { name: string; description: string }
> = {
  "vipbox-classic": {
    name: "VIPBOX Classic",
    description:
      "Notre borne emblématique : écran tactile, imprimante intégrée, photos en quelques secondes. La valeur sûre pour tous vos événements.",
  },
  smart: {
    name: "Smart",
    description:
      "Une version compacte de la VIPBOX. Même expérience, format optimisé. La Smart est idéale pour les espaces plus intimistes.",
  },
  "spinner-360": {
    name: "Spinner 360°",
    description:
      "Le bras rotatif capture vos invités sous tous les angles et génère des vidéos spectaculaires à partager instantanément.",
  },
};

export function getModelPrice(slug: string, eventDate: string): number {
  const month = new Date(eventDate + "T12:00:00").getMonth() + 1; // 1–12

  switch (slug as V1ModelSlug) {
    case "vipbox-classic":
      if (month === 9) return 440; // septembre
      if (month >= 5 && month <= 8) return 390; // mai–août
      return 340; // jan–avr, oct–déc

    case "smart":
      if (month >= 5 && month <= 9) return 340; // mai–sep
      return 290; // oct–avr

    case "spinner-360":
      return 490;

    default:
      return 0;
  }
}

export function getSeasonLabel(slug: string, eventDate: string): string {
  const month = new Date(eventDate + "T12:00:00").getMonth() + 1;

  if (slug === "vipbox-classic") {
    if (month === 9) return "Haute saison";
    if (month >= 5 && month <= 8) return "Moyenne saison";
    return "Basse saison";
  }
  if (slug === "smart") {
    return month >= 5 && month <= 9 ? "Haute saison" : "Basse saison";
  }
  return "Prix fixe";
}

export function getModelName(slug: string): string | null {
  return (MODEL_META as Record<string, { name: string }>)[slug]?.name ?? null;
}

export function getAvailableModels(
  availableSlugs: string[],
  eventDate: string,
): PhotoboothModel[] {
  return V1_MODEL_SLUGS.filter((slug) => availableSlugs.includes(slug)).map(
    (slug) => ({
      slug,
      ...MODEL_META[slug],
      price: getModelPrice(slug, eventDate),
    }),
  );
}

// Options catalogue — keyed by model slug
const OPTIONS_CATALOGUE: Record<V1ModelSlug, Option[]> = {
  "vipbox-classic": [
    {
      id: "classic-pack-full",
      name: "Pack Full Options Numériques",
      description: "GIF + Boomerang + Livre d'or numérique + Boîte à questions",
      price: 100,
    },
    { id: "classic-gif", name: "Mode GIF", price: 30 },
    { id: "classic-boomerang", name: "Mode Boomerang", price: 30 },
    { id: "classic-video", name: "Mode Vidéo", price: 40 },
    { id: "classic-boite-questions", name: "Boîte à questions", price: 60 },
    { id: "classic-livre-or", name: "Livre d'or numérique", price: 30 },
    { id: "classic-veille", name: "Personnalisation écran de veille", price: 30 },
    { id: "classic-mise-en-page-1", name: "Mise en page supplémentaire", price: 30 },
    { id: "classic-mise-en-page-2", name: "2 Mises en page supplémentaires", price: 60 },
    { id: "classic-tirages-400", name: "400 tirages supplémentaires", price: 80 },
    { id: "classic-tirages-800", name: "800 tirages supplémentaires", price: 160 },
    { id: "classic-reimpression", name: "Ré-impression de toutes les photos", price: 80 },
  ],
  smart: [
    {
      id: "smart-pack-full",
      name: "Pack Full Options Numériques",
      description: "GIF + Boomerang",
      price: 60,
    },
    { id: "smart-boomerang", name: "Mode Boomerang", price: 30 },
    { id: "smart-gif", name: "Mode GIF", price: 30 },
    { id: "smart-mise-en-page-1", name: "Mise en page supplémentaire", price: 30 },
    { id: "smart-mise-en-page-2", name: "2 Mises en page supplémentaires", price: 60 },
    { id: "smart-tirages-400", name: "400 tirages supplémentaires", price: 80 },
  ],
  "spinner-360": [
    {
      id: "spinner-confort",
      name: "Forfait Confort",
      description: "Livraison + installation + opérateur sur place",
      price: 260,
    },
  ],
};

export function getOptionsForModel(slug: V1ModelSlug): Option[] {
  return OPTIONS_CATALOGUE[slug] ?? [];
}

// Flat price lookup for all option IDs — used by promo yield management
export const OPTION_PRICE_LOOKUP: Record<string, number> = Object.fromEntries(
  (Object.values(OPTIONS_CATALOGUE) as Option[][]).flat().map((o) => [o.id, o.price]),
);

// WP region taxonomy — IDs and names (stable, matches vip-box.fr)
export const WP_REGIONS = [
  { id: 14, name: "Auvergne-Rhône-Alpes" },
  { id: 15, name: "Bourgogne-Franche-Comté" },
  { id: 16, name: "Bretagne" },
  { id: 17, name: "Centre-Val de Loire" },
  { id: 18, name: "Corse" },
  { id: 19, name: "Grand Est" },
  { id: 28, name: "Guadeloupe" },
  { id: 20, name: "Hauts-de-France" },
  { id: 21, name: "Île-de-France" },
  { id: 27, name: "Martinique" },
  { id: 22, name: "Normandie" },
  { id: 23, name: "Nouvelle-Aquitaine" },
  { id: 24, name: "Occitanie" },
  { id: 25, name: "Pays de la Loire" },
  { id: 26, name: "Provence-Alpes-Côte d'Azur" },
] as const;
