"use client";

import React, { useState } from "react";

type Reservation = {
  id: string;
  status: string;
  created_at: string;
  event_date: string;
  pickup_point_name: string | null;
  pickup_point_full_address: string | null;
  model_name: string | null;
  model_price: number | null;
  options: string | null;
  promo_code: string | null;
  promo_discount: number | null;
  total_amount: number;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_postal_code: string | null;
  customer_city: string | null;
  crm_prestation_id: number | null;
};

const STATUS: Record<string, { label: string; classes: string }> = {
  "payé":       { label: "Payé",       classes: "bg-green-50 text-green-700" },
  "en_attente": { label: "En attente", classes: "bg-amber-50 text-amber-700" },
  "échoué":     { label: "Échoué",     classes: "bg-red-50 text-red-600"    },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, classes: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.classes}`}>
      {s.label}
    </span>
  );
}

// Anciennes commandes stockaient les options en JSON ({id, name, price}[])
// Nouvelles commandes les stockent en texte "Nom (30 €), Nom2 (Offert)"
function formatOptions(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((o: { name?: string; price?: number }) =>
        o.name ? `${o.name}${o.price ? ` (${o.price} €)` : ""}` : JSON.stringify(o),
      )
      .join(", ");
  }
  return JSON.stringify(raw);
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 shrink-0 w-28">{label}</span>
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  );
}

function ExpandedDetail({ r }: { r: Reservation }) {
  const address = r.customer_address
    ? `${r.customer_address}, ${r.customer_postal_code ?? ""} ${r.customer_city ?? ""}`.trim()
    : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 px-4 py-4 bg-gray-50 border-t border-gray-100">
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
        <DetailRow label="E-mail" value={r.customer_email} />
        <DetailRow label="Téléphone" value={r.customer_phone} />
        <DetailRow label="Adresse" value={address} />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Commande</p>
        <DetailRow label="Options" value={formatOptions(r.options)} />
        <DetailRow
          label="Code promo"
          value={r.promo_code
            ? `${r.promo_code}${r.promo_discount ? ` (−${r.promo_discount} €)` : ""}`
            : null}
        />
        <DetailRow label="ID Supabase" value={r.id} />
        <DetailRow label="ID CRM" value={r.crm_prestation_id} />
      </div>
    </div>
  );
}

// Échappe une valeur pour un champ CSV (guillemets doublés, entourée de
// guillemets si elle contient une virgule/un saut de ligne/un guillemet)
function toCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function exportReservationsCsv(reservations: Reservation[]) {
  const headers = [
    "Statut", "Créée le", "Nom", "Prénom", "E-mail", "Téléphone",
    "Adresse", "Code postal", "Ville", "Date événement", "Point de retrait",
    "Modèle", "Options", "Code promo", "Remise", "Total", "ID CRM", "ID Supabase",
  ];

  const rows = reservations.map((r) => [
    STATUS[r.status]?.label ?? r.status,
    fmtDatetime(r.created_at),
    r.customer_last_name ?? "",
    r.customer_first_name ?? "",
    r.customer_email ?? "",
    r.customer_phone ?? "",
    r.customer_address ?? "",
    r.customer_postal_code ?? "",
    r.customer_city ?? "",
    fmtDate(r.event_date),
    r.pickup_point_name ?? "",
    r.model_name ?? "",
    formatOptions(r.options) ?? "",
    r.promo_code ?? "",
    r.promo_discount ?? "",
    r.total_amount,
    r.crm_prestation_id ?? "",
    r.id,
  ]);

  const csv = [headers, ...rows].map((row) => row.map(toCsvField).join(",")).join("\n");
  // BOM UTF-8 en tête : sans lui, Excel affiche mal les accents à l'ouverture directe du fichier
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reservations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReservationTable({ reservations }: { reservations: Reservation[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (reservations.length === 0) {
    return <p className="text-sm text-gray-400">Aucune réservation pour l'instant.</p>;
  }

  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => exportReservationsCsv(reservations)}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Exporter en CSV
        </button>
      </div>
      <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Statut</th>
              <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Commande</th>
              <th className="px-4 py-3 font-medium text-gray-500">Client</th>
              <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Événement</th>
              <th className="px-4 py-3 font-medium text-gray-500">Point de retrait</th>
              <th className="px-4 py-3 font-medium text-gray-500">Modèle</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right whitespace-nowrap">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => {
              const expanded = expandedId === r.id;
              return (
                <React.Fragment key={r.id}>
                  <tr
                    onClick={() => toggle(r.id)}
                    className={[
                      "border-b border-gray-100 cursor-pointer",
                      expanded ? "bg-gray-50" : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtDatetime(r.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {(r.customer_last_name ?? "").toUpperCase()} {r.customer_first_name ?? ""}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {fmtDate(r.event_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                      {r.pickup_point_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {r.model_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium text-right whitespace-nowrap">
                      {r.total_amount} €
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span
                        className={[
                          "inline-block text-gray-400 transition-transform duration-150 text-xs",
                          expanded ? "rotate-180" : "",
                        ].join(" ")}
                      >
                        ▾
                      </span>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={8} className="p-0">
                        <ExpandedDetail r={r} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
