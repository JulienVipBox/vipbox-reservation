"use client";

import { STATUS, fmtDate, fmtDatetime, formatOptions, type Reservation } from "./ReservationTable";

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

export function ExportButton({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) return null;

  return (
    <button
      onClick={() => exportReservationsCsv(reservations)}
      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      Exporter en CSV
    </button>
  );
}
