"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";
import { Turnstile } from "./Turnstile";
import type { CustomerInfo } from "@/types";

type Errors = Partial<Record<keyof CustomerInfo, string>>;

function validate(d: CustomerInfo): Errors {
  const e: Errors = {};
  if (!d.lastName.trim()) e.lastName = "Champ requis";
  if (!d.firstName.trim()) e.firstName = "Champ requis";
  if (!d.email.trim()) e.email = "Champ requis";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    e.email = "Adresse e-mail invalide";
  if (!d.phone.trim()) e.phone = "Champ requis";
  if (!d.address.trim()) e.address = "Champ requis";
  if (!d.postalCode.trim()) e.postalCode = "Champ requis";
  if (!d.city.trim()) e.city = "Champ requis";
  return e;
}

const INPUT =
  "w-full rounded-[5px] border border-gray-300 px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
const INPUT_ERROR =
  "w-full rounded-[5px] border border-red-400 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-400";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function CoordonneesForm() {
  const router = useRouter();
  const {
    model,
    pickupPoint,
    eventDate,
    options,
    promoCode,
    customer,
    setCustomer,
    setReservationId,
  } = useReservationStore();

  useEffect(() => {
    if (!eventDate) router.replace("/reservation/date");
    else if (!pickupPoint) router.replace("/reservation/lieu");
    else if (!model) router.replace("/reservation/modele");
  }, [eventDate, pickupPoint, model, router]);

  const [form, setForm] = useState<CustomerInfo>({
    lastName: customer?.lastName ?? "",
    firstName: customer?.firstName ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    postalCode: customer?.postalCode ?? "",
    city: customer?.city ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  if (!model || !pickupPoint || !eventDate) {
    return <div className="text-sm text-gray-400 animate-pulse">Chargement…</div>;
  }

  const set = (field: keyof CustomerInfo) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...form, [field]: e.target.value };
      setForm(next);
      if (submitted) setErrors(validate(next));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    setSaveError("");

    // Le prix, les options offertes et le total ne sont plus envoyés : le
    // serveur les recalcule lui-même à partir de model_slug/selected_option_ids/
    // promo_code (voir app/api/reservations/route.ts) pour ne jamais faire
    // confiance à un montant venu du navigateur.
    const payload = {
      event_date: eventDate,
      pickup_point_name: pickupPoint.name,
      pickup_point_slug: pickupPoint.slug,
      pickup_point_full_address: pickupPoint.fullAddress ?? null,
      pickup_point_horaires: pickupPoint.horaires ?? null,
      pickup_point_phone: pickupPoint.phone ?? null,
      pickup_point_region_ids: pickupPoint.regionIds,
      model_slug: model.slug,
      selected_option_ids: options.map((o) => o.id),
      promo_code: promoCode ?? null,
      customer_first_name: form.firstName,
      customer_last_name: form.lastName,
      customer_email: form.email,
      customer_phone: form.phone,
      customer_address: form.address,
      customer_postal_code: form.postalCode,
      customer_city: form.city,
      turnstileToken,
    };

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.id) {
        setSaveError(data.error || "Une erreur est survenue. Veuillez réessayer.");
        setSaving(false);
        return;
      }

      setCustomer(form);
      setReservationId(data.id);
      router.push("/reservation/paiement");
    } catch {
      setSaveError("Une erreur est survenue. Veuillez réessayer.");
      setSaving(false);
    }
  };

  const inp = (field: keyof CustomerInfo) =>
    errors[field] ? INPUT_ERROR : INPUT;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 max-w-xl mx-auto">
      <Field label="Nom" error={errors.lastName}>
        <input
          type="text"
          value={form.lastName}
          onChange={set("lastName")}
          autoComplete="family-name"
          className={inp("lastName")}
        />
      </Field>

      <Field label="Prénom" error={errors.firstName}>
        <input
          type="text"
          value={form.firstName}
          onChange={set("firstName")}
          autoComplete="given-name"
          className={inp("firstName")}
        />
      </Field>

      <Field label="E-mail" error={errors.email}>
        <input
          type="email"
          value={form.email}
          onChange={set("email")}
          autoComplete="email"
          className={inp("email")}
        />
      </Field>

      <Field label="Téléphone" error={errors.phone}>
        <input
          type="tel"
          value={form.phone}
          onChange={set("phone")}
          autoComplete="tel"
          className={inp("phone")}
        />
      </Field>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700">
          Adresse postale
        </legend>

        <Field label="Rue et numéro" error={errors.address}>
          <input
            type="text"
            value={form.address}
            onChange={set("address")}
            autoComplete="street-address"
            className={inp("address")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Code postal" error={errors.postalCode}>
            <input
              type="text"
              value={form.postalCode}
              onChange={set("postalCode")}
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={5}
              className={inp("postalCode")}
            />
          </Field>

          <Field label="Ville" error={errors.city}>
            <input
              type="text"
              value={form.city}
              onChange={set("city")}
              autoComplete="address-level2"
              className={inp("city")}
            />
          </Field>
        </div>
      </fieldset>

      <div className="!mt-0">
        <Turnstile onVerify={setTurnstileToken} />
      </div>

      {saveError && (
        <p className="text-sm text-red-500 text-center">{saveError}</p>
      )}

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[5px] bg-gold px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Enregistrement…" : "Continuer"}
          {!saving && <span aria-hidden>→</span>}
        </button>
      </div>
    </form>
  );
}
