"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReservationStore } from "@/lib/store";
import { getAvailableModels, getSeasonLabel, getOptionsForModel } from "@/lib/models";
import type { PhotoboothModel, V1ModelSlug } from "@/types";
import type { PromoEffect } from "@/lib/store";

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
  discount,
  onSelect,
}: {
  model: PhotoboothModel;
  isSelected: boolean;
  eventDate: string;
  discount: number;
  onSelect: () => void;
}) {
  const season = getSeasonLabel(model.slug, eventDate);
  const discountedPrice = model.price - discount;

  return (
    <button
      onClick={onSelect}
      className={[
        "relative text-left rounded-2xl border-2 overflow-hidden transition-colors w-full flex flex-col",
        isSelected ? "border-gold" : "border-gray-200 hover:border-gray-400",
      ].join(" ")}
    >
      {isSelected && (
        <span className="absolute top-3 right-3 z-10 rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-brand">
          ✓ Sélectionné
        </span>
      )}

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
          <p className="text-sm text-gray-500 leading-snug">{model.description}</p>
        </div>
      </div>

      <div className="px-5 pb-5 flex items-end justify-between">
        <div>
          {discount > 0 ? (
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-green-700">{discountedPrice} €</p>
              <p className="text-sm text-gray-400 line-through">{model.price} €</p>
            </div>
          ) : (
            <p className="text-xl font-bold text-gray-900">{model.price} €</p>
          )}
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
    promoCode,
    promoEffect,
    promoAutoApplied,
    setModel,
    applyPromoCode,
  } = useReservationStore();

  const autoFetched = useRef(false);

  // Yield management : applique automatiquement le meilleur code si aucun n'est déjà actif
  useEffect(() => {
    if (!eventDate || !pickupPoint || promoCode || autoFetched.current) return;
    autoFetched.current = true;

    const params = new URLSearchParams({ eventDate, prSlug: pickupPoint.slug });
    for (const rid of pickupPoint.regionIds) {
      params.append("regionIds", String(rid));
    }

    fetch(`/api/promo/auto?${params}`)
      .then((r) => r.json())
      .then((data: { code: string; effect: PromoEffect } | null) => {
        if (data?.code && data.effect) {
          applyPromoCode(data.code, data.effect, true);
        }
      })
      .catch(() => null);
  }, [eventDate, pickupPoint, promoCode, applyPromoCode]);

  useEffect(() => {
    if (!eventDate) router.replace("/reservation/date");
    else if (!pickupPoint) router.replace("/reservation/lieu");
  }, [eventDate, pickupPoint, router]);

  if (!pickupPoint || !eventDate) {
    return <div className="text-sm text-gray-400 animate-pulse">Chargement…</div>;
  }

  const models = getAvailableModels(pickupPoint.availableModelSlugs, eventDate);
  const discount = promoEffect?.discountAmount ?? 0;
  const freeOptionIds = promoEffect?.freeOptionIds ?? [];

  const handleSelect = (m: PhotoboothModel) => {
    // Sauvegarde le code avant que setModel() l'efface
    const savedCode = promoCode;
    const savedAuto = promoAutoApplied;
    const savedDiscount = promoEffect?.discountAmount ?? 0;
    const savedFreeIds = promoEffect?.freeOptionIds ?? [];

    setModel(m); // efface le code promo dans le store

    // Si le code était auto-appliqué, on le restaure en filtrant les options
    // offertes selon le modèle effectivement choisi
    if (savedAuto && savedCode) {
      const modelOptionIds = new Set(getOptionsForModel(m.slug).map((o) => o.id));
      const filteredFreeIds = savedFreeIds.filter((id) => modelOptionIds.has(id));
      applyPromoCode(
        savedCode,
        { discountAmount: savedDiscount, freeOptionIds: filteredFreeIds },
        true,
      );
    }

    router.push("/reservation/code-promo");
  };

  if (models.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Aucun modèle disponible à ce point de retrait.{" "}
        <button onClick={() => router.back()} className="underline hover:no-underline">
          Choisir un autre point de retrait
        </button>
      </p>
    );
  }

  // Résumé de l'avantage promo pour le bandeau
  const promoParts: string[] = [];
  if (discount > 0) promoParts.push(`−${discount} €`);
  if (freeOptionIds.length > 0)
    promoParts.push(
      `${freeOptionIds.length} option${freeOptionIds.length > 1 ? "s" : ""} offerte${freeOptionIds.length > 1 ? "s" : ""} selon le modèle choisi`,
    );

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

      {promoCode && promoParts.length > 0 && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm space-y-0.5">
          <p className="font-semibold text-green-800">
            Un code promo s&apos;applique à votre réservation !
          </p>
          <p className="text-green-700">
            Code <span className="font-mono font-bold">{promoCode}</span>{" "}
            : {promoParts.join(" + ")}
          </p>
          <p className="text-xs text-green-600">
            Ce code a été appliqué automatiquement pour votre date et votre lieu.
            Vous pourrez le modifier à l&apos;étape suivante.
          </p>
        </div>
      )}

      {promoCode && discount === 0 && freeOptionIds.length === 0 && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
          Code <span className="font-mono font-bold">{promoCode}</span> appliqué automatiquement.
        </div>
      )}

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
          <div key={m.slug} className={models.length === 1 ? "w-full max-w-xs" : undefined}>
            <ModelCard
              model={m}
              isSelected={selectedModel?.slug === m.slug}
              eventDate={eventDate}
              discount={discount}
              onSelect={() => handleSelect(m)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
