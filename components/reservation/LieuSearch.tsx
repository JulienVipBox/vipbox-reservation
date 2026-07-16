"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { geocodeAddress, findNearestPickupPoints } from "@/lib/geo";
import { useReservationStore } from "@/lib/store";
import type { PickupPoint } from "@/types";

const MODEL_LABELS: Record<string, string> = {
  "vipbox-classic": "VIPBOX Classic",
  smart: "Smart",
  "spinner-360": "Spinner 360°",
};

function PickupPointCard({
  pp,
  onSelect,
}: {
  pp: PickupPoint;
  onSelect: () => void;
}) {
  const distLabel =
    pp.distanceKm !== undefined
      ? pp.distanceKm < 1
        ? `${Math.round(pp.distanceKm * 1000)} m`
        : `${pp.distanceKm.toFixed(1)} km`
      : null;

  return (
    <div className="rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-gray-900 truncate">{pp.name}</h3>
          {distLabel && (
            <span className="shrink-0 text-sm font-medium text-gray-400">
              {distLabel}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600">
          {pp.fullAddress || `${pp.address}, ${pp.postalCode} ${pp.city}`}
        </p>

        {pp.horaires && (
          <p className="text-xs text-gray-400 whitespace-pre-line leading-relaxed">
            {pp.horaires}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {pp.availableModelSlugs.map((slug) => (
            <span
              key={slug}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {MODEL_LABELS[slug] ?? slug}
            </span>
          ))}
        </div>
      </div>

      <div className="sm:shrink-0">
        <button
          onClick={onSelect}
          className="w-full sm:w-auto rounded-[5px] border-2 border-gray-900 px-5 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-900 hover:text-white"
        >
          Choisir
        </button>
      </div>
    </div>
  );
}

export function LieuSearch({
  pickupPoints,
}: {
  pickupPoints: PickupPoint[];
}) {
  const router = useRouter();
  const { setPickupPoint } = useReservationStore();

  const [input, setInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<PickupPoint[] | null>(null);
  const [geocodedLabel, setGeocodedLabel] = useState("");
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    setIsSearching(true);
    setError("");
    setResults(null);

    try {
      const geo = await geocodeAddress(query);
      if (!geo) {
        setError("Adresse introuvable. Vérifiez votre saisie et réessayez.");
        return;
      }

      const nearest = findNearestPickupPoints(geo.lat, geo.lng, pickupPoints);
      setGeocodedLabel(geo.label);
      setResults(nearest);

      if (nearest.length === 0) {
        setError(
          "Aucun point de retrait n'est disponible dans votre région pour les modèles proposés.",
        );
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (pp: PickupPoint) => {
    setPickupPoint(pp);
    router.push("/reservation/modele");
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 max-w-xl mx-auto sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Exemple : 15 rue de la Paix, Paris"
          disabled={isSearching}
          className="w-full rounded-[5px] border border-gray-300 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50 sm:flex-1"
        />
        <button
          type="submit"
          disabled={isSearching || !input.trim()}
          className="w-full sm:w-auto rounded-[5px] bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isSearching ? "Recherche…" : "Rechercher"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {results !== null && results.length > 0 && (
        <div className="space-y-4 max-w-xl mx-auto text-left">
          <p className="text-sm text-gray-500">
            Points de retrait les plus proches de{" "}
            <span className="font-medium text-gray-900">{geocodedLabel}</span>
          </p>
          <div className="space-y-3">
            {results.map((pp) => (
              <PickupPointCard
                key={pp.id}
                pp={pp}
                onSelect={() => handleSelect(pp)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
