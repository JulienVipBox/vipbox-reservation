import type { Metadata } from "next";
import { getPickupPoints } from "@/lib/wordpress";
import { getCrmPickupPointCapacities } from "@/lib/crm";
import { CapacityTable, type CapacityRow } from "./CapacityTable";

export const metadata: Metadata = { title: "Disponibilités" };

// Page d'édition en direct des capacités CRM : ne doit jamais servir une
// copie mise en cache (sinon un simple F5 après une modif côté CRM peut
// encore afficher l'ancienne valeur, voir mémoire projet 2026-07-16).
export const dynamic = "force-dynamic";

export default async function DisponibilitesPage() {
  const [pickupPoints, capacities] = await Promise.all([
    getPickupPoints(),
    getCrmPickupPointCapacities(),
  ]);

  const capacityByCrmId = new Map(capacities.map((c) => [c.ID, c]));

  const rows: CapacityRow[] = pickupPoints
    .filter((pp) => pp.crmId !== undefined)
    .map((pp) => {
      const cap = capacityByCrmId.get(pp.crmId!);
      return {
        crmId: pp.crmId!,
        name: pp.name,
        postalCode: pp.postalCode,
        reservation_maximum_classic: cap?.reservation_maximum_classic ?? null,
        reservation_maximum_smart: cap?.reservation_maximum_smart ?? null,
        reservation_maximum_360: cap?.reservation_maximum_360 ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // PR du site sans correspondance CRM — le champ ACF id_base est vide ou ne
  // correspond à aucune fiche point_retrait côté CRM. Leurs capacités ne
  // peuvent pas être éditées ici tant que id_base n'est pas renseigné.
  const unmatched = pickupPoints.filter((pp) => pp.crmId === undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Disponibilités par point de retrait</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nombre d'unités réservables simultanément, par modèle. Une valeur à 0 bloque
          les réservations de ce modèle à ce PR. Enregistrement automatique en quittant
          le champ.
        </p>
      </div>

      {unmatched.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            ⚠️ {unmatched.length} PR du site n&apos;ont aucune correspondance dans le CRM
            (champ ACF id_base vide ou invalide) — leurs capacités ne peuvent pas être
            éditées ici :
          </p>
          <ul className="mt-1 list-disc pl-5">
            {unmatched.map((pp) => (
              <li key={pp.id}>
                {pp.name} ({pp.postalCode})
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun point de retrait rapproché du CRM.</p>
      ) : (
        <CapacityTable rows={rows} />
      )}
    </div>
  );
}
