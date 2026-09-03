"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { V1_MODEL_SLUGS } from "@/types";
import { getOptionsForModel, WP_REGIONS } from "@/lib/models";

const MODEL_LABELS: Record<string, string> = {
  "vipbox-classic": "VIPBOX Classic",
  smart: "Smart",
  "spinner-360": "Spinner 360°",
};

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type Pr = { slug: string; name: string };

export function NewPromoForm({ prs }: { prs: Pr[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [freeOptionIds, setFreeOptionIds] = useState<string[]>([]);
  const [bookingFrom, setBookingFrom] = useState("");
  const [bookingUntil, setBookingUntil] = useState("");
  const [eventFrom, setEventFrom] = useState("");
  const [eventUntil, setEventUntil] = useState("");
  const [geoType, setGeoType] = useState<"all" | "regions" | "prs">("all");
  const [selectedRegions, setSelectedRegions] = useState<number[]>([]);
  const [selectedPrs, setSelectedPrs] = useState<string[]>([]);
  const [prSearch, setPrSearch] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxPerUser, setMaxPerUser] = useState("");
  const [emailsRaw, setEmailsRaw] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleOption = (id: string) =>
    setFreeOptionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleRegion = (id: number) =>
    setSelectedRegions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const togglePr = (slug: string) =>
    setSelectedPrs((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug],
    );

  const filteredPrs = prs.filter(
    (p) =>
      !prSearch ||
      p.name.toLowerCase().includes(prSearch.toLowerCase()) ||
      p.slug.includes(prSearch.toLowerCase()),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!code.trim()) return setError("Le code est requis.");
    if (discountAmount === 0 && freeOptionIds.length === 0)
      return setError("Ajoutez une remise ou des options offertes.");

    setSubmitting(true);

    const emails = emailsRaw
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const body = {
      code: code.toUpperCase().trim(),
      discount_amount: discountAmount,
      free_option_ids: freeOptionIds,
      booking_valid_from: bookingFrom || null,
      booking_valid_until: bookingUntil || null,
      event_valid_from: eventFrom || null,
      event_valid_until: eventUntil || null,
      allowed_region_ids: geoType === "regions" ? selectedRegions : [],
      allowed_pr_slugs: geoType === "prs" ? selectedPrs : [],
      max_uses: maxUses ? Number(maxUses) : null,
      max_uses_per_user: maxPerUser ? Number(maxPerUser) : null,
      allowed_emails: emails,
    };

    const res = await fetch("/api/admin/codes-promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/admin/codes-promo");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de la création.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Code ───────────────────────────────────────────── */}
      <Card title="Code">
        <div className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex : SUMMER2026"
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-mono uppercase tracking-widest focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="button"
            onClick={() => setCode(randomCode())}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
          >
            Générer
          </button>
        </div>
      </Card>

      {/* ── Effet ──────────────────────────────────────────── */}
      <Card title="Effet">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-28 shrink-0">Remise</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="w-24 rounded-xl border border-gray-300 px-3 py-2 text-sm text-center focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <span className="text-sm text-gray-500">€</span>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-3">Options offertes</p>
            <div className="space-y-4">
              {V1_MODEL_SLUGS.map((slug) => {
                const opts = getOptionsForModel(slug);
                return (
                  <div key={slug}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {MODEL_LABELS[slug]}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {opts.map((o) => (
                        <label key={o.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={freeOptionIds.includes(o.id)}
                            onChange={() => toggleOption(o.id)}
                            className="h-4 w-4 rounded border-gray-300 text-brand accent-[#03071E]"
                          />
                          <span className="text-sm text-gray-700">
                            {o.name}{" "}
                            <span className="text-gray-400">({o.price} €)</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Validité ───────────────────────────────────────── */}
      <Card title="Validité (optionnel)">
        <div className="space-y-3">
          <DateRange
            label="Date de réservation"
            from={bookingFrom}
            until={bookingUntil}
            onFrom={setBookingFrom}
            onUntil={setBookingUntil}
          />
          <DateRange
            label="Date d'événement"
            from={eventFrom}
            until={eventUntil}
            onFrom={setEventFrom}
            onUntil={setEventUntil}
          />
        </div>
      </Card>

      {/* ── Zone géographique ──────────────────────────────── */}
      <Card title="Zone géographique">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            {(["all", "regions", "prs"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="geoType"
                  checked={geoType === t}
                  onChange={() => setGeoType(t)}
                  className="h-4 w-4 accent-[#03071E]"
                />
                <span className="text-sm text-gray-700">
                  {t === "all" && "Partout"}
                  {t === "regions" && "Par région"}
                  {t === "prs" && "Points de retrait spécifiques"}
                </span>
              </label>
            ))}
          </div>

          {geoType === "regions" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {WP_REGIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRegion(r.id)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedRegions.includes(r.id)
                      ? "border-brand bg-brand text-white"
                      : "border-gray-300 text-gray-600 hover:border-gray-500",
                  ].join(" ")}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          {geoType === "prs" && (
            <div className="space-y-2 pt-1">
              <input
                type="text"
                placeholder="Rechercher un point de retrait…"
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                {filteredPrs.map((p) => (
                  <label
                    key={p.slug}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPrs.includes(p.slug)}
                      onChange={() => togglePr(p.slug)}
                      className="h-4 w-4 accent-[#03071E]"
                    />
                    <span className="text-sm text-gray-700">{p.name}</span>
                  </label>
                ))}
              </div>
              {selectedPrs.length > 0 && (
                <p className="text-xs text-gray-400">
                  {selectedPrs.length} PR sélectionné{selectedPrs.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Limites ────────────────────────────────────────── */}
      <Card title="Limites (optionnel)">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1.5">
              Utilisations totales max
            </label>
            <input
              type="number"
              min={1}
              placeholder="Illimité"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1.5">
              Max par personne (e-mail)
            </label>
            <input
              type="number"
              min={1}
              placeholder="Illimité"
              value={maxPerUser}
              onChange={(e) => setMaxPerUser(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>
      </Card>

      {/* ── E-mails ciblés ─────────────────────────────────── */}
      <Card title="E-mails ciblés (optionnel)">
        <textarea
          rows={4}
          placeholder={"Une adresse par ligne :\nclient@exemple.fr\nautreclient@exemple.fr"}
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono resize-none focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="text-xs text-gray-400 mt-1">
          Laissez vide pour ne pas restreindre à des e-mails spécifiques.
        </p>
      </Card>

      {error && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3 pb-8">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand px-8 py-3 text-sm font-semibold text-white hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Création…" : "Créer le code"}
        </button>
        <a
          href="/admin/codes-promo"
          className="rounded-xl border border-gray-300 px-6 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </a>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function DateRange({
  label,
  from,
  until,
  onFrom,
  onUntil,
}: {
  label: string;
  from: string;
  until: string;
  onFrom: (v: string) => void;
  onUntil: (v: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="text-sm text-gray-600 w-44 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <span className="text-gray-400 text-xs shrink-0">au</span>
        <input
          type="date"
          value={until}
          onChange={(e) => onUntil(e.target.value)}
          min={from}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
    </div>
  );
}
