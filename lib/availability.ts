// SERVER-SIDE ONLY — ne jamais importer depuis un composant client
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCrmPickupPointCapacity, type CapacityField } from "@/lib/crm";
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

/**
 * Nombre de réservations déjà PAYÉES pour ce lieu + modèle + date exacte.
 * Seul `status = 'payé'` compte : une réservation `en_attente` n'a pas encore
 * immobilisé de matériel réel (design déjà décidé, voir mémoire projet).
 */
export async function countPaidReservations(
  pickupPointSlug: string,
  modelSlug: string,
  eventDate: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("pickup_point_slug", pickupPointSlug)
    .eq("model_slug", modelSlug)
    .eq("event_date", eventDate)
    .eq("status", "payé");

  if (error) {
    console.error("[availability] countPaidReservations failed:", error);
    return 0; // panne de comptage → ne pas bloquer un client réel
  }

  return count ?? 0;
}

/**
 * Disponibilité de chaque modèle demandé, pour un lieu + une date.
 * @returns { [modelSlug]: true si disponible }
 */
export async function checkModelsAvailability(
  pickupPoint: PickupPoint,
  eventDate: string,
  modelSlugs: V1ModelSlug[],
): Promise<Record<string, boolean>> {
  const results = await Promise.all(
    modelSlugs.map(async (slug) => {
      const capacity = await getModelCapacity(pickupPoint, slug);
      if (capacity === null) return [slug, true] as const; // inconnu → disponible

      const count = await countPaidReservations(pickupPoint.slug, slug, eventDate);
      return [slug, count < capacity] as const;
    }),
  );

  return Object.fromEntries(results);
}
