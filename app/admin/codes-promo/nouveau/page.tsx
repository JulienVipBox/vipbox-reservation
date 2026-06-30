import { getPickupPoints } from "@/lib/wordpress";
import { NewPromoForm } from "./NewPromoForm";

export default async function NouveauCodePromoPage() {
  const pickupPoints = await getPickupPoints().catch(() => []);
  const prs = pickupPoints.map((p) => ({ slug: p.slug, name: p.name }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin/codes-promo" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Retour
        </a>
        <h1 className="text-xl font-bold text-gray-900">Nouveau code promo</h1>
      </div>
      <NewPromoForm prs={prs} />
    </div>
  );
}
