// SERVER-SIDE ONLY — ne jamais importer depuis un composant client
import { getCrmPickupPointCapacity, getCrmBookingCount, type CapacityField } from "@/lib/crm";
import type { PickupPoint, V1ModelSlug } from "@/types";

const CAPACITY_FIELD_BY_MODEL: Record<V1ModelSlug, CapacityField> = {
  "vipbox-classic": "reservation_maximum_classic",
  smart: "reservation_maximum_smart",
  "spinner-360": "reservation_maximum_360",
};

/**
 * Capacité (nombre d'unités réservables simultanément) d'un modèle donné à un
 * point de retrait donné, lue sur la fiche CRM correspondante (via
 * `pickupPoint.crmId`, résolu par `id_base` dans lib/wordpress.ts). `null` =
 * capacité inconnue (PR pas encore rapproché du CRM, fiche sans valeur, ou
 * CRM injoignable) → ne doit jamais bloquer un client réel (même philosophie
 * que Turnstile/rate-limit : une donnée manquante ou une panne ne doit jamais
 * rendre le tunnel inutilisable, seulement désactiver la vérification tant
 * qu'elle n'est pas fiable).
 */
export async function getModelCapacity(
  pickupPoint: PickupPoint,
  modelSlug: V1ModelSlug,
): Promise<number | null> {
  if (pickupPoint.crmId === undefined) return null;

  const capacity = await getCrmPickupPointCapacity(pickupPoint.crmId);
  if (!capacity) return null;

  return capacity[CAPACITY_FIELD_BY_MODEL[modelSlug]];
}

export type ModelAvailability = "available" | "full" | "hidden";

/**
 * Disponibilité de chaque modèle demandé, pour un lieu + une date.
 * - "hidden" : capacité connue et à 0 — ce modèle n'existe pas à ce PR, la
 *   carte ne doit pas s'afficher du tout (pas juste grisée).
 * - "full" : capacité > 0 mais atteinte pour cette date précise (comptage
 *   réel sur `prestations`, tous canaux) — carte affichée, grisée.
 * - "available" : réservable, ou capacité inconnue (fail open).
 */
export async function checkModelsAvailability(
  pickupPoint: PickupPoint,
  eventDate: string,
  modelSlugs: V1ModelSlug[],
): Promise<Record<string, ModelAvailability>> {
  const results = await Promise.all(
    modelSlugs.map(async (slug) => {
      const capacity = await getModelCapacity(pickupPoint, slug);
      if (capacity === null) return [slug, "available"] as const;
      if (capacity === 0) return [slug, "hidden"] as const;

      // capacity > 0 ici, donc getModelCapacity a forcément trouvé un crmId
      const count = await getCrmBookingCount(pickupPoint.crmId!, slug, eventDate);
      return [slug, count < capacity ? "available" : "full"] as const;
    }),
  );

  return Object.fromEntries(results);
}
