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

  // Montant réellement autoritaire (celui recalculé et stocké côté serveur à
  // la création de la réservation, identique à celui envoyé à CAWL) — le
  // store Zustand peut être obsolète (ex. retour en arrière puis changement
  // de date sans re-sélection du modèle, qui ne réinitialise pas `model`) et
  // afficher un total différent de celui réellement facturé. `null` tant que
  // non chargé, pour ne jamais afficher un montant potentiellement faux.
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [totalError, setTotalError] = useState(false);

  useEffect(() => {
    if (!eventDate) { router.replace("/reservation/date"); return; }
    if (!pickupPoint) { router.replace("/reservation/lieu"); return; }
    if (!model) { router.replace("/reservation/modele"); return; }
    if (!customer) { router.replace("/reservation/coordonnees"); return; }
    if (!reservationId) { router.replace("/reservation/coordonnees"); return; }
  }, [eventDate, pickupPoint, model, customer, reservationId, router]);

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    fetch(`/api/reservations?id=${encodeURIComponent(reservationId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setServerTotal(data.total_amount);
      })
      .catch(() => {
        if (!cancelled) setTotalError(true);
      });
    return () => { cancelled = true; };
  }, [reservationId]);

  if (!model || !customer || !reservationId) return null;

  const discount = promoEffect?.discountAmount ?? 0;
  const optionsTotal = options.reduce((s, o) => s + o.price, 0);
  const localTotal = Math.max(0, model.price + optionsTotal - discount);
  // En cas d'échec de la récupération serveur, on retombe sur le calcul
  // local plutôt que de bloquer l'affichage — le montant réellement facturé
  // reste de toute façon celui recalculé côté serveur dans
  // /api/cawl/create-checkout, jamais celui-ci.
  const total = serverTotal ?? (totalError ? localTotal : null);

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
        <span className="font-bold text-2xl text-white">
          {total === null ? "…" : `${total} €`}
        </span>
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <button
        onClick={handlePay}
        disabled={loading || total === null}
        className="w-full rounded-[5px] bg-gold px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Redirection en cours…" : "Payer par carte bancaire"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Paiement 100&nbsp;% sécurisé — vous allez être redirigé vers notre prestataire bancaire.
      </p>
    </div>
  );
}
