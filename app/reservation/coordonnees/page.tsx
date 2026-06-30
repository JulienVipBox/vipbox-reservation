import { CoordonneesForm } from "@/components/reservation/CoordonneesForm";

export default function CoordonneesPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Vos coordonnées</h1>
        <p className="text-gray-600">
          Ces informations serviront à établir votre contrat de location.
        </p>
      </div>
      <CoordonneesForm />
    </div>
  );
}
