"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";

export function PromoCode() {
  const router = useRouter();
  const {
    model,
    pickupPoint,
    eventDate,
    promoCode,
    promoEffect,
    promoAutoApplied,
    applyPromoCode,
    clearPromoCode,
  } = useReservationStore();

  useEffect(() => {
    if (!eventDate) router.replace("/reservation/date");
    else if (!pickupPoint) router.replace("/reservation/lieu");
    else if (!model) router.replace("/reservation/modele");
  }, [eventDate, pickupPoint, model, router]);

  const [input, setInput] = useState(promoCode ?? "");
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);

  const isApplied = !!promoCode && !!promoEffect;

  if (!model || !pickupPoint || !eventDate) {
    return <div className="text-sm text-gray-400 animate-pulse">Chargement…</div>;
  }

  const promoDescription = (() => {
    if (!promoEffect) return "";
    const parts: string[] = [];
    if (promoEffect.discountAmount > 0) parts.push(`−${promoEffect.discountAmount} €`);
    if (promoEffect.freeOptionIds.length > 0)
      parts.push(
        `${promoEffect.freeOptionIds.length} option${promoEffect.freeOptionIds.length > 1 ? "s" : ""} offerte${promoEffect.freeOptionIds.length > 1 ? "s" : ""}`,
      );
    return parts.join(" + ");
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = input.trim().toUpperCase();

    if (!code) {
      clearPromoCode();
      router.push("/reservation/options");
      return;
    }

    setValidating(true);
    setError("");

    const res = await fetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        eventDate,
        prSlug: pickupPoint.slug,
        prRegionIds: pickupPoint.regionIds,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setValidating(false);

    if (!data.valid) {
      setError("Ce code promo n'est pas valide ou a expiré.");
      return;
    }

    applyPromoCode(code, data.effect, false);
    setError("");
  };

  const handleSkip = () => {
    clearPromoCode();
    router.push("/reservation/options");
  };

  return (
    <div className="space-y-6 max-w-sm mx-auto">
      {isApplied ? (
        <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 text-center space-y-1.5">
          <p className="font-semibold text-green-800">
            Code «&nbsp;{promoCode}&nbsp;» appliqué
          </p>
          {promoDescription && (
            <p className="text-sm text-green-700">{promoDescription}</p>
          )}
          {promoAutoApplied && (
            <p className="text-xs text-green-600">
              Appliqué automatiquement pour votre date et votre lieu
            </p>
          )}
          <button
            onClick={() => {
              clearPromoCode();
              setInput("");
              setError("");
            }}
            className="block mx-auto text-xs text-green-600 underline hover:no-underline pt-0.5"
          >
            {promoAutoApplied ? "Saisir un autre code" : "Retirer"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="Ex : SUMMER25"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm uppercase tracking-widest focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:flex-1"
            />
            <button
              type="submit"
              disabled={validating}
              className="w-full sm:w-auto rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
            >
              {validating ? "Vérification…" : "Appliquer"}
            </button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center">
          <button
            onClick={() => router.push("/reservation/options")}
            disabled={!isApplied && input.trim() !== "" && !error}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Continuer
            <span aria-hidden>→</span>
          </button>
        </div>
        {!isApplied && (
          <button
            onClick={handleSkip}
            className="text-sm text-gray-400 hover:text-gray-600 hover:underline"
          >
            Je n&apos;ai pas de code promo
          </button>
        )}
      </div>
    </div>
  );
}
