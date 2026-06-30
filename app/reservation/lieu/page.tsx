import { getPickupPoints } from "@/lib/wordpress";
import { LieuSearch } from "@/components/reservation/LieuSearch";

export default async function LieuPage() {
  let pickupPoints;
  try {
    pickupPoints = await getPickupPoints();
  } catch {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Lieu de votre événement</h1>
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          Impossible de charger les points de retrait. Veuillez réessayer
          ultérieurement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Lieu de votre événement</h1>
        <p className="text-gray-600">
          Entrez l&apos;adresse de votre événement pour trouver les points de
          retrait les plus proches.
        </p>
      </div>

      <LieuSearch pickupPoints={pickupPoints} />
    </div>
  );
}
