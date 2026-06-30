"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";
import { getOptionsForModel } from "@/lib/models";
import type { V1ModelSlug } from "@/types";

export function OptionsSelector() {
  const router = useRouter();
  const {
    model,
    eventDate,
    pickupPoint,
    promoCode,
    promoEffect,
    options: selectedOptions,
    toggleOption,
  } = useReservationStore();

  useEffect(() => {
    if (!eventDate) router.replace("/reservation/date");
    else if (!pickupPoint) router.replace("/reservation/lieu");
    else if (!model) router.replace("/reservation/modele");
  }, [eventDate, pickupPoint, model, router]);

  if (!model || !eventDate) {
    return (
      <div className="text-sm text-gray-400 animate-pulse">Chargement…</div>
    );
  }

  const catalogueOptions = getOptionsForModel(model.slug as V1ModelSlug);
  const freeOptionIds = promoEffect?.freeOptionIds ?? [];

  // Options offertes (prix ramené à 0€, toujours cochées)
  const freeOptions = catalogueOptions
    .filter((o) => freeOptionIds.includes(o.id))
    .map((o) => ({ ...o, price: 0 }));

  // Les options offertes ne doivent pas être dans selectedOptions (gérées séparément)
  const userSelectedOptions = selectedOptions.filter(
    (o) => !freeOptionIds.includes(o.id),
  );

  const freeTotal = 0; // always 0
  const userTotal = userSelectedOptions.reduce((sum, o) => sum + o.price, 0);
  const subtotal = model.price + freeTotal + userTotal;
  const discount = promoEffect?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="space-y-8 max-w-xl mx-auto text-left">
      <p className="text-sm text-gray-500 text-center">
        Modèle :{" "}
        <span className="font-medium text-gray-900">{model.name}</span>
        <button
          onClick={() => router.back()}
          className="ml-3 text-xs text-gray-400 underline hover:text-gray-700"
        >
          Changer
        </button>
      </p>

      {promoCode && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
          Code promo <strong>{promoCode}</strong> appliqué
          {discount > 0 && <> — remise de {discount} €</>}
        </div>
      )}

      {/* Options offertes par le code promo */}
      {freeOptions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Offert avec votre code promo
          </p>
          {freeOptions.map((option) => (
            <div
              key={option.id}
              className="w-full text-left rounded-2xl border-2 border-green-300 bg-green-50 p-4 flex items-start gap-4"
            >
              <div className="mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 bg-green-600 border-green-600 text-white">
                <span className="text-xs leading-none">✓</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-gray-900">{option.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                      Offert
                    </span>
                    <span className="font-semibold text-gray-400 line-through text-sm">
                      {catalogueOptions.find((o) => o.id === option.id)?.price} €
                    </span>
                  </div>
                </div>
                {option.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Options au choix */}
      <div className="space-y-3">
        {freeOptions.length > 0 && (
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Options supplémentaires
          </p>
        )}
        {catalogueOptions
          .filter((o) => !freeOptionIds.includes(o.id))
          .map((option) => {
            const isSelected = userSelectedOptions.some((o) => o.id === option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggleOption(option)}
                className={[
                  "w-full text-left rounded-2xl border-2 p-4 flex items-start gap-4 transition-colors",
                  isSelected
                    ? "border-brand bg-gray-50"
                    : "border-gray-200 hover:border-gray-400",
                ].join(" ")}
              >
                <div
                  className={[
                    "mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors",
                    isSelected
                      ? "bg-brand border-brand text-white"
                      : "border-gray-300",
                  ].join(" ")}
                >
                  {isSelected && <span className="text-xs leading-none">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-gray-900">{option.name}</p>
                    <p className="font-semibold text-gray-900 shrink-0">
                      +{option.price} €
                    </p>
                  </div>
                  {option.description && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {option.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
      </div>

      {/* Récapitulatif du prix */}
      <div className="rounded-2xl bg-gray-50 p-5 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{model.name}</span>
          <span>{model.price} €</span>
        </div>
        {freeOptions.map((o) => (
          <div key={o.id} className="flex justify-between text-sm text-green-700">
            <span className="truncate mr-4">{o.name}</span>
            <span className="shrink-0 font-medium">Offert</span>
          </div>
        ))}
        {userSelectedOptions.map((o) => (
          <div key={o.id} className="flex justify-between text-sm text-gray-600">
            <span className="truncate mr-4">{o.name}</span>
            <span className="shrink-0">+{o.price} €</span>
          </div>
        ))}
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-700">
            <span>Code promo {promoCode}</span>
            <span>−{discount} €</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
          <span>Total</span>
          <span>{total} €</span>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => router.push("/reservation/recapitulatif")}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand/80"
        >
          Continuer
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
