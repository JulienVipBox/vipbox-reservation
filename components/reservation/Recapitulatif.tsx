"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useReservationStore } from "@/lib/store";
import { getSeasonLabel } from "@/lib/models";

function formatDate(iso: string): string {
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso + "T12:00:00"));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Section({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <Link href={editHref} className="text-sm font-medium text-gray-400 hover:text-gray-600 hover:underline">
          Modifier
        </Link>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function Recapitulatif() {
  const router = useRouter();
  const { eventDate, pickupPoint, model, options } = useReservationStore();

  useEffect(() => {
    if (!eventDate) router.replace("/reservation/date");
    else if (!pickupPoint) router.replace("/reservation/lieu");
    else if (!model) router.replace("/reservation/modele");
  }, [eventDate, pickupPoint, model, router]);

  if (!eventDate || !pickupPoint || !model) {
    return <div className="text-sm text-gray-400 animate-pulse">Chargement…</div>;
  }

  const optionsTotal = options.reduce((sum, o) => sum + o.price, 0);
  const total = model.price + optionsTotal;
  const season = getSeasonLabel(model.slug, eventDate);

  return (
    <div className="space-y-4">
      <Section title="Date de l'événement" editHref="/reservation/date">
        <p className="text-gray-800">{formatDate(eventDate)}</p>
      </Section>

      <Section title="Point de retrait" editHref="/reservation/lieu">
        <p className="font-medium text-gray-900">{pickupPoint.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{pickupPoint.fullAddress}</p>
        {pickupPoint.horaires && (
          <p className="text-sm text-gray-500 mt-3 whitespace-pre-line leading-relaxed">
            {pickupPoint.horaires}
          </p>
        )}
      </Section>

      <Section title="Modèle" editHref="/reservation/modele">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900">{model.name}</p>
            {season && <p className="text-sm text-gray-400 mt-0.5">{season}</p>}
          </div>
          <p className="font-semibold text-gray-900 shrink-0">{model.price} €</p>
        </div>
      </Section>

      <Section title="Options" editHref="/reservation/options">
        {options.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune option sélectionnée</p>
        ) : (
          <ul className="space-y-2">
            {options.map((o) => (
              <li key={o.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{o.name}</span>
                <span className="font-medium text-gray-900">{o.price} €</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Total */}
      <div className="rounded-2xl bg-brand text-white px-5 py-4">
        <div className="space-y-1.5 text-sm mb-3">
          <div className="flex justify-between text-white/70">
            <span>{model.name}</span>
            <span>{model.price} €</span>
          </div>
          {options.map((o) => (
            <div key={o.id} className="flex justify-between text-white/70">
              <span>{o.name}</span>
              <span>{o.price} €</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center border-t border-white/20 pt-3">
          <span className="font-semibold text-lg">Total</span>
          <span className="font-bold text-2xl text-white">{total} €</span>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => router.push("/reservation/coordonnees")}
          className="inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Continuer
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
