// SERVER-SIDE ONLY — ne jamais importer depuis un composant client
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PickupPoint, V1ModelSlug } from "@/types";

/**
 * ⚠️ SOURCE DE VÉRITÉ PROVISOIRE (pré-prod, 2026-07-XX).
 *
 * En attendant que le CRM (`point_retrait`) reçoive 3 colonnes dédiées
 * (`reservation_maximum_classic`, `reservation_maximum_smart`,
 * `reservation_maximum_360` — demande faite par Julien en interne), la
 * capacité par modèle est une valeur fixe codée ici, uniquement pour pouvoir
 * coder et tester le mécanisme de blocage avant que la vraie donnée existe.
 *
 * À REMPLACER dès que les colonnes CRM existent : lire ces 3 champs sur la
 * fiche `point_retrait` correspondant à `pickupPoint.crmId` (déjà disponible
 * sur PickupPoint, résolu par code postal dans lib/wordpress.ts), au lieu de
 * cette table fixe. Un seul endroit à changer : getModelCapacity() ci-dessous.
 */
const PLACEHOLDER_CAPACITY: Record<V1ModelSlug, number> = {
  "vipbox-classic": 2,
  smart: 2,
  "spinner-360": 1,
};

/**
 * Capacité (nombre d'unités réservables simultanément) d'un modèle donné à un
 * point de retrait donné. `null` = capacité inconnue → ne doit jamais bloquer
 * un client réel (même philosophie que Turnstile/rate-limit : une donnée
 * manquante ou une panne côté CRM ne doit jamais rendre le tunnel inutilisable,
 * seulement désactiver la vérification tant qu'elle n'est pas fiable).
 */
export function getModelCapacity(
  pickupPoint: PickupPoint,
  modelSlug: V1ModelSlug,
): number | null {
  void pickupPoint; // pas encore utilisé — le sera pour lire le CRM via crmId
  return PLACEHOLDER_CAPACITY[modelSlug] ?? null;
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
      const capacity = getModelCapacity(pickupPoint, slug);
      if (capacity === null) return [slug, true] as const; // inconnu → disponible

      const count = await countPaidReservations(pickupPoint.slug, slug, eventDate);
      return [slug, count < capacity] as const;
    }),
  );

  return Object.fromEntries(results);
}
