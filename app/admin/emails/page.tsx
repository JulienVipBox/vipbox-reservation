"use client";

import { useEffect, useState } from "react";

const DEFAULTS = {
  email_internal_recipients: "julien@vip-box.fr",
  email_client_subject: "Votre réservation et vos identifiants VIPBOX — {date}",
  email_client_intro:
    "Votre réservation VIPBOX est bien enregistrée. Voici le récapitulatif de votre commande, ainsi que vos identifiants. Ils vous permettront de préparer votre événement (personnalisation de vos tirages photos, etc.) sur votre espace client sécurisé.",
};

type Settings = typeof DEFAULTS;

function SaveFeedback({ saved, error }: { saved: boolean; error: string }) {
  if (error) return <span className="text-sm text-red-500">{error}</span>;
  if (saved) return <span className="text-sm text-green-600 font-medium">Sauvegardé ✓</span>;
  return null;
}

export default function EmailSettingsPage() {
  const [values, setValues] = useState<Settings>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);

  const [savingNotif, setSavingNotif] = useState(false);
  const [savedNotif, setSavedNotif] = useState(false);
  const [errorNotif, setErrorNotif] = useState("");

  const [savingClient, setSavingClient] = useState(false);
  const [savedClient, setSavedClient] = useState(false);
  const [errorClient, setErrorClient] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d: Partial<Settings>) => {
        setValues({
          email_internal_recipients:
            d.email_internal_recipients ?? DEFAULTS.email_internal_recipients,
          email_client_subject:
            d.email_client_subject ?? DEFAULTS.email_client_subject,
          email_client_intro:
            d.email_client_intro ?? DEFAULTS.email_client_intro,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (key: keyof Settings) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (key === "email_internal_recipients") setSavedNotif(false);
    else setSavedClient(false);
  };

  const save = async (
    keys: (keyof Settings)[],
    setSaving: (b: boolean) => void,
    setSaved: (b: boolean) => void,
    setError: (s: string) => void,
  ) => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const body = Object.fromEntries(keys.map((k) => [k, values[k]]));
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const INPUT =
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Paramètres e-mails</h1>

      {/* Section notification interne */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Notification interne
        </h2>
        <p className="text-sm text-gray-500">
          Destinataires du mail de notification à chaque nouvelle commande.
          Plusieurs adresses séparées par des virgules.
        </p>

        {loading ? (
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(
                ["email_internal_recipients"],
                setSavingNotif,
                setSavedNotif,
                setErrorNotif,
              );
            }}
            className="space-y-3"
          >
            <input
              type="text"
              value={values.email_internal_recipients}
              onChange={set("email_internal_recipients")}
              placeholder="julien@vip-box.fr, ops@vip-box.fr"
              className={INPUT}
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingNotif}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {savingNotif ? "Enregistrement…" : "Enregistrer"}
              </button>
              <SaveFeedback saved={savedNotif} error={errorNotif} />
            </div>
          </form>
        )}
      </div>

      {/* Section email client */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Email de confirmation client
        </h2>

        {loading ? (
          <div className="space-y-3">
            <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(
                ["email_client_subject", "email_client_intro"],
                setSavingClient,
                setSavedClient,
                setErrorClient,
              );
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Objet
              </label>
              <input
                type="text"
                value={values.email_client_subject}
                onChange={set("email_client_subject")}
                className={INPUT}
              />
              <p className="text-xs text-gray-400">
                Variables disponibles : <code className="bg-gray-100 px-1 rounded">{"{date}"}</code>{" "}
                <code className="bg-gray-100 px-1 rounded">{"{prenom}"}</code>{" "}
                <code className="bg-gray-100 px-1 rounded">{"{nom}"}</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Texte d'introduction
              </label>
              <textarea
                value={values.email_client_intro}
                onChange={set("email_client_intro")}
                rows={4}
                className={INPUT + " resize-y"}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingClient}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {savingClient ? "Enregistrement…" : "Enregistrer"}
              </button>
              <SaveFeedback saved={savedClient} error={errorClient} />
            </div>
          </form>
        )}
      </div>

      {/* Section expéditeur (lecture seule) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Expéditeur
        </h2>
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Nom :</span> VIPBOX</p>
          <p><span className="font-medium">Adresse :</span> reservation@vip-box.fr</p>
        </div>
      </div>
    </div>
  );
}
