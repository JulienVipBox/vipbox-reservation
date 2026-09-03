"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";

export function Paiement() {
  const router = useRouter();
  const { eventDate, pickupPoint, model, customer, reservationId, options, promoEffect } =
    useReservationStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventDate) { router.replace("/reservation/date"); return; }
    if (!pickupPoint) { router.replace("/reservation/lieu"); return; }
    if (!model) { router.replace("/reservation/modele"); return; }
    if (!customer) { router.replace("/reservation/coordonnees"); return; }
    if (!reservationId) { router.replace("/reservation/coordonnees"); return; }
  }, [eventDate, pickupPoint, model, customer, reservationId, router]);

  if (!model || !customer || !reservationId) return null;

  // Même calcul que Recapitulatif.tsx — fiable désormais que setEventDate()
  // (lib/store.ts) recalcule model.price à chaque changement de date, donc
  // ce total reste toujours identique à celui recalculé côté serveur et
  // réellement facturé par CAWL (voir /api/reservations POST).
  const discount = promoEffect?.discountAmount ?? 0;
  const optionsTotal = options.reduce((s, o) => s + o.price, 0);
  const total = Math.max(0, model.price + optionsTotal - discount);

  // Crée la session de paiement CAWL côté serveur puis redirige le client
  // vers la page de paiement hébergée — voir lib/cawl.ts pour le détail.
  const handlePay = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cawl/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.redirectUrl) {
        setError(data.error ?? "Impossible de démarrer le paiement. Merci de réessayer.");
        setLoading(false);
        return;
      }

      window.location.href = data.redirectUrl;
    } catch {
      setError("Impossible de démarrer le paiement. Merci de réessayer.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Récap montant */}
      <div className="rounded-2xl bg-brand text-white px-5 py-4 flex justify-between items-center">
        <span className="font-semibold">Total à régler</span>
        <span className="font-bold text-2xl text-white">{total} €</span>
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <div className="flex justify-center">
        <button
          onClick={handlePay}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-[5px] bg-gold px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Redirection en cours…" : "Payer par carte bancaire"}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Paiement 100&nbsp;% sécurisé.
        <br />
        Vous allez être redirigé vers notre prestataire bancaire.
      </p>
    </div>
  );
}
