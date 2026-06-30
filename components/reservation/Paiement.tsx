"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";

export function Paiement() {
  const router = useRouter();
  const { eventDate, pickupPoint, model, customer, reservationId, options, promoEffect } =
    useReservationStore();

  useEffect(() => {
    if (!eventDate) { router.replace("/reservation/date"); return; }
    if (!pickupPoint) { router.replace("/reservation/lieu"); return; }
    if (!model) { router.replace("/reservation/modele"); return; }
    if (!customer) { router.replace("/reservation/coordonnees"); return; }
    if (!reservationId) { router.replace("/reservation/coordonnees"); return; }
  }, [eventDate, pickupPoint, model, customer, reservationId, router]);

  if (!model || !customer || !reservationId) return null;

  const discount = promoEffect?.discountAmount ?? 0;
  const optionsTotal = options.reduce((s, o) => s + o.price, 0);
  const total = Math.max(0, model.price + optionsTotal - discount);

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Récap montant */}
      <div className="rounded-2xl bg-brand text-white px-5 py-4 flex justify-between items-center">
        <span className="font-semibold">Total à régler</span>
        <span className="font-bold text-2xl text-white">{total} €</span>
      </div>

      {/* Placeholder Stripe */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-400 space-y-2">
        <p className="font-medium">Formulaire de paiement Stripe</p>
        <p className="text-sm">À intégrer (Stripe Elements)</p>
      </div>
    </div>
  );
}
