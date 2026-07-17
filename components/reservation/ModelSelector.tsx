"use client";

import { useEffect, useRef, useState } from "react";
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
  isAvailable,
  eventDate,
  discount,
  onSelect,
}: {
  model: PhotoboothModel;
  isSelected: boolean;
  isAvailable: boolean;
  eventDate: string;
  discount: number;
  onSelect: () => void;
}) {
  const season = getSeasonLabel(model.slug, eventDate);
  const discountedPrice = model.price - discount;

  return (
    <button
      onClick={isAvailable ? onSelect : undefined}
      disabled={!isAvailable}
      aria-disabled={!isAvailable}
      className={[
        "relative text-left rounded-2xl border-2 overflow-hidden transition-colors w-full flex flex-col",
        !isAvailable
          ? "border-gray-200 opacity-50 cursor-not-allowed grayscale"
          : isSelected
            ? "border-gold"
            : "border-gray-200 hover:border-gray-400",
      ].join(" ")}
    >
      {isSelected && isAvailable && (
        <span className="absolute top-3 right-3 z-10 rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-brand">
          ✓ Sélectionné
        </span>
      )}
      {!isAvailable && (
        <span className="absolute top-3 right-3 z-10 rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-white">
          Non disponible à cette date
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
        {isAvailable && (
          <span className="text-sm font-medium text-gray-400">Choisir →</span>
        )}
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
  const [availability, setAvailability] = useState<
    Record<string, "available" | "full" | "hidden">
  >({});
  // Tant que la vérification n'a pas répondu, on n'affiche pas encore la
  // grille de modèles — sinon un modèle caché ou grisé apparaît d'abord en
  // "disponible" (valeur par défaut) puis change d'état une fraction de
  // seconde plus tard, ce qui donne une impression de scintillement/bug.
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);

  // Blocage des disponibilités : vérifie, pour chaque modèle proposé à ce lieu
  // et cette date, s'il reste de la capacité (voir lib/availability.ts —
  // capacité + réservations réelles lues sur le CRM). "hidden" (capacité à 0)
  // retire la carte de la liste ; "full" (complet à cette date précise) la
  // grise. Par défaut (avant réponse, ou en cas d'erreur) tout est traité
  // comme disponible : une panne de cette vérification ne doit jamais
  // bloquer un client réel, seulement désactiver le filtrage/grisage tant
  // qu'elle n'est pas fiable.
  useEffect(() => {
    if (!pickupPoint || !eventDate) return;
    setAvailabilityLoaded(false);

    const slugs = getAvailableModels(pickupPoint.availableModelSlugs, eventDate).map(
      (m) => m.slug,
    );
    if (slugs.length === 0) {
      setAvailabilityLoaded(true);
      return;
    }

    fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupPoint, eventDate, modelSlugs: slugs }),
    })
      .then((r) => r.json())
      .then(
        (data: { availability?: Record<string, "available" | "full" | "hidden"> }) =>
          setAvailability(data.availability ?? {}),
      )
      .catch(() => setAvailability({}))
      .finally(() => setAvailabilityLoaded(true));
  }, [pickupPoint, eventDate]);

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

  if (!availabilityLoaded) {
    return (
      <div className="text-sm text-gray-400 animate-pulse">
        Chargement des disponibilités…
      </div>
    );
  }

  const models = getAvailableModels(pickupPoint.availableModelSlugs, eventDate).filter(
    (m) => availability[m.slug] !== "hidden",
  );
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
      <p className="inline-block rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Aucun modèle disponible à ce point de retrait.{" "}
        <button onClick={() => router.back()} className="underline hover:no-underline">
          Choisir un autre point de retrait
        </button>
      </p>
    );
  }

  const allUnavailable = models.every((m) => availability[m.slug] === "full");

  if (allUnavailable) {
    return (
      <div className="space-y-5 text-center">
        <p className="inline-block rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Tous les photobooths de cette agence sont déjà réservés à cette date.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => router.push("/reservation/lieu")}
            className="rounded-[5px] border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-500 transition-colors"
          >
            Changer de lieu
          </button>
          <button
            onClick={() => router.push("/reservation/date")}
            className="rounded-[5px] border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-500 transition-colors"
          >
            Changer de date
          </button>
        </div>
      </div>
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
        <div className="inline-block rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
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
              isAvailable={availability[m.slug] !== "full"}
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
