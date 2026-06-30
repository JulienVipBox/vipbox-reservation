import { Recapitulatif } from "@/components/reservation/Recapitulatif";

export default function RecapitulatifPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Récapitulatif</h1>
        <p className="text-gray-600">
          Vérifiez les détails de votre réservation avant de continuer.
        </p>
      </div>
      <Recapitulatif />
    </div>
  );
}
