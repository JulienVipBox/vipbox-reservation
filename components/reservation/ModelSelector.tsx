"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReservationStore } from "@/lib/store";
import { getAvailableModels, getSeasonLabel } from "@/lib/models";
import type { PhotoboothModel, V1ModelSlug } from "@/types";

const MODEL_IMAGES: Record<V1ModelSlug, string> = {
  "vipbox-classic":
    "https://www.vip-box.fr/wp-content/uploads/2026/04/Classic-Oai-1-air.jpg",
  smart: "https://www.vip-box.fr/wp-content/uploads/2026/04/Smart-Oai-1-air.jpg",
  "spinner-360":
    "https://www.vip-box.fr/wp-content/uploads/2026/04/Spinner-Oai-1-air.jpg",
};

function ModelCard({
  model,
  isSelected,
  eventDate,
  onSelect,
}: {
  model: PhotoboothModel;
  isSelected: boolean;
  eventDate: string;
  onSelect: () => void;
}) {
  const season = getSeasonLabel(model.slug, eventDate);

  return (
    <button
      onClick={onSelect}
      className={[
        "relative text-left rounded-2xl border-2 overflow-hidden transition-colors w-full flex flex-col",
        isSelected
          ? "border-gold"
          : "border-gray-200 hover:border-gray-400",
      ].join(" ")}
    >
      {isSelected && (
        <span className="absolute top-3 right-3 z-10 rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-brand">
          ✓ Sélectionné
        </span>
      )}

      {/* TOP — image + titre + description */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
          <Image
            src={MODEL_IMAGES[model.slug]}
            alt={model.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        </div>

        <div className="space-y-1 flex-1">
          <p className="font-semibold text-gray-900">{model.name}</p>
          <p className="text-sm text-gray-500 leading-snug">
            {model.description}
          </p>
        </div>
      </div>

      {/* BOTTOM — prix + saison + CTA */}
      <div className="px-5 pb-5 flex items-end justify-between">
        <div>
          <p className="text-xl font-bold text-gray-900">{model.price} €</p>
          {season && <p className="text-xs text-gray-400">{season}</p>}
        </div>
        <span className="text-sm font-medium text-gray-400">Choisir →</span>
      </div>
    </button>
  );
}

export function ModelSelector() {
  const router = useRouter();
  const {
    pickupPoint,
    eventDate,
    model: selectedModel,
    setModel,
  } = useReservationStore();

  useEffect(() => {
    if (!eventDate) router.replace("/reservation/date");
    else if (!pickupPoint) router.replace("/reservation/lieu");
  }, [eventDate, pickupPoint, router]);

  if (!pickupPoint || !eventDate) {
    return (
      <div className="text-sm text-gray-400 animate-pulse">Chargement…</div>
    );
  }

  const models = getAvailableModels(pickupPoint.availableModelSlugs, eventDate);

  const handleSelect = (m: PhotoboothModel) => {
    setModel(m);
    router.push("/reservation/code-promo");
  };

  if (models.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Aucun modèle disponible à ce point de retrait.{" "}
        <button
          onClick={() => router.back()}
          className="underline hover:no-underline"
        >
          Choisir un autre point de retrait
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Point de retrait :{" "}
        <span className="font-medium text-gray-900">{pickupPoint.name}</span>
        <button
          onClick={() => router.back()}
          className="ml-3 text-xs text-gray-400 underline hover:text-gray-700"
        >
          Changer
        </button>
      </p>

      <div
        className={
          models.length === 1
            ? "flex justify-center"
            : models.length === 2
              ? "grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto items-stretch"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
        }
      >
        {models.map((m) => (
          <div
            key={m.slug}
            className={models.length === 1 ? "w-full max-w-xs" : undefined}
          >
            <ModelCard
              model={m}
              isSelected={selectedModel?.slug === m.slug}
              eventDate={eventDate}
              onSelect={() => handleSelect(m)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
