import { PromoCode } from "@/components/reservation/PromoCode";

export default function CodePromoPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Code promo</h1>
        <p className="text-gray-600">
          Vous avez un code promo ? Saisissez-le ci-dessous pour en bénéficier.
        </p>
      </div>
      <PromoCode />
    </div>
  );
}
