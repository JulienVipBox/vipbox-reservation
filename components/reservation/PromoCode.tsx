"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";
import { validatePromoCode } from "@/lib/promo";

export function PromoCode() {
  const router = useRouter();
  const { model, pickupPoint, eventDate, promoCode, applyPromoCode, clearPromoCode } =
    useReservationStore();

  useEffect(() => {
    if (!eventDate) router.replace("/reservation/date");
    else if (!pickupPoint) router.replace("/reservation/lieu");
    else if (!model) router.replace("/reservation/modele");
  }, [eventDate, pickupPoint, model, router]);

  const [input, setInput] = useState(promoCode ?? "");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<{ code: string; description: string } | null>(
    promoCode ? { code: promoCode, description: "" } : null,
  );

  if (!model || !pickupPoint || !eventDate) {
    return <div className="text-sm text-gray-400 animate-pulse">Chargement…</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = input.trim().toUpperCase();

    if (!code) {
      clearPromoCode();
      router.push("/reservation/options");
      return;
    }

    const effect = validatePromoCode(code);

    if (!effect) {
      setError("Ce code promo n'est pas valide ou a expiré.");
      return;
    }

    applyPromoCode(code, effect);

    const parts: string[] = [];
    if (effect.discountAmount > 0) parts.push(`−${effect.discountAmount} €`);
    if (effect.freeOptionIds.length > 0)
      parts.push(
        `${effect.freeOptionIds.length} option${effect.freeOptionIds.length > 1 ? "s" : ""} offerte${effect.freeOptionIds.length > 1 ? "s" : ""}`,
      );

    setApplied({ code, description: parts.join(" + ") });
    setError("");
  };

  const handleSkip = () => {
    clearPromoCode();
    router.push("/reservation/options");
  };

  return (
    <div className="space-y-6 max-w-sm mx-auto">
      {applied ? (
        <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-green-800">Code «&nbsp;{applied.code}&nbsp;» appliqué</p>
            {applied.description && (
              <p className="text-sm text-green-700 mt-0.5">{applied.description}</p>
            )}
          </div>
          <button
            onClick={() => {
              clearPromoCode();
              setApplied(null);
              setInput("");
            }}
            className="text-xs text-green-600 underline hover:no-underline shrink-0 mt-0.5"
          >
            Retirer
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
              className="w-full sm:w-auto rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 whitespace-nowrap"
            >
              Appliquer
            </button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center">
          <button
            onClick={() => router.push("/reservation/options")}
            disabled={!applied && input.trim() !== "" && !error}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Continuer
            <span aria-hidden>→</span>
          </button>
        </div>
        {!applied && (
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
