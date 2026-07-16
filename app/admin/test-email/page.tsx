"use client";

// ⚠️ PAGE DE TEST — À SUPPRIMER AVANT LA MISE EN PRODUCTION
import { useState } from "react";

export default function TestEmailPage() {
  const [reservationId, setReservationId] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationId.trim()) return;

    setStatus("sending");
    setMessage("");

    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: reservationId.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus("ok");
        setMessage("Emails envoyés. Vérifiez votre boîte mail et les logs Brevo.");
      } else {
        setStatus("error");
        setMessage(data.error ?? `Erreur ${res.status}`);
      }
    } catch (err) {
      setStatus("error");
      setMessage(String(err));
    }
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-800">Page de test — à supprimer avant production</p>
        <p className="mt-1 text-xs text-amber-700">
          Déclenche manuellement l&apos;envoi des emails pour une réservation existante dans Supabase.
          Utiliser uniquement avec une réservation dont l&apos;email est le vôtre.
        </p>
      </div>

      <h1 className="mb-6 text-xl font-bold text-gray-900">Test envoi e-mails</h1>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-5">
        <div className="space-y-2 text-sm text-gray-600">
          <p className="font-medium text-gray-800">Mode opératoire :</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Faire une réservation de test jusqu&apos;à l&apos;étape Coordonnées (avec votre email)</li>
            <li>Dans Supabase → Table Editor → reservations → copier l&apos;UUID de la ligne créée</li>
            <li>Coller l&apos;UUID ci-dessous et cliquer Envoyer</li>
            <li>Vérifier la boîte mail + Brevo → Transactional → Email logs</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              UUID de la réservation Supabase
            </label>
            <input
              type="text"
              value={reservationId}
              onChange={(e) => {
                setReservationId(e.target.value);
                setStatus("idle");
                setMessage("");
              }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono
                         focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {message && (
            <p className={`text-sm ${status === "ok" ? "text-green-600" : "text-red-500"}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending" || !reservationId.trim()}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white
                       transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "sending" ? "Envoi en cours…" : "Envoyer les emails de test"}
          </button>
        </form>
      </div>
    </div>
  );
}
