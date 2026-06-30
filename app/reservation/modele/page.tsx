import { ModelSelector } from "@/components/reservation/ModelSelector";

export default function ModelePage() {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Choisissez votre modèle</h1>
        <p className="text-gray-600">
          Modèles disponibles au point de retrait sélectionné.
        </p>
      </div>

      <ModelSelector />
    </div>
  );
}
