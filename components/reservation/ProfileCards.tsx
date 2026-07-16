"use client";

import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";

export function ProfileCards() {
  const router = useRouter();
  const { setClientType } = useReservationStore();

  const handleParticulier = () => {
    setClientType("particulier");
    router.push("/reservation/date");
  };

  // Les demandes Pro sortent du tunnel : redirigées vers le formulaire de
  // devis du site vitrine (?type=pro bypass l'étape 1 du formulaire WP).
  const handleProfessionnel = () => {
    window.location.href = "https://www.vip-box.fr/contact/?type=pro";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl mx-auto">
      <button
        onClick={handleParticulier}
        className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 p-6 text-center transition-colors hover:border-brand"
      >
        <span className="text-3xl">🎉</span>
        <div>
          <p className="font-semibold text-lg">Particulier</p>
          <p className="text-sm text-gray-500 mt-1">
            Mariage, anniversaire, fête privée…
          </p>
        </div>
        <span className="text-sm font-medium text-gray-400 group-hover:text-brand transition-colors">
          Réserver en ligne →
        </span>
      </button>

      <button
        onClick={handleProfessionnel}
        className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 p-6 text-center transition-colors hover:border-brand"
      >
        <span className="text-3xl">🏢</span>
        <div>
          <p className="font-semibold text-lg">Professionnel</p>
          <p className="text-sm text-gray-500 mt-1">
            Salon, événement d&apos;entreprise…
          </p>
        </div>
        <span className="text-sm font-medium text-gray-400 group-hover:text-brand transition-colors">
          Demander un devis →
        </span>
      </button>
    </div>
  );
}
