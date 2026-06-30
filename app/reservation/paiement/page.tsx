import { Paiement } from "@/components/reservation/Paiement";

export default function PaiementPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Paiement</h1>
        <p className="text-gray-600">
          Réglez votre réservation en toute sécurité par carte bancaire.
        </p>
      </div>
      <Paiement />
    </div>
  );
}
