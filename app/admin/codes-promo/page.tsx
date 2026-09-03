import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { WP_REGIONS } from "@/lib/models";

export const metadata: Metadata = { title: "Codes promo" };

// Même raison que /admin/reservations et /admin/disponibilites : sans ceci,
// un code créé/modifié après le dernier déploiement resterait invisible ici
// jusqu'au déploiement suivant (mise en cache serveur App Router).
export const dynamic = "force-dynamic";

import type { PromoCode } from "@/types";
import { PromoToggle } from "./PromoToggle";

function regionName(id: number): string {
  return WP_REGIONS.find((r) => r.id === id)?.name ?? String(id);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default async function CodesPromoPage() {
  const { data } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  const codes = (data ?? []) as PromoCode[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Codes promo</h1>
        <Link
          href="/admin/codes-promo/nouveau"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-80 transition-opacity"
        >
          + Nouveau code
        </Link>
      </div>

      {codes.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun code promo pour l'instant.</p>
      ) : (
        <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Effet</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Validité événement</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Zone</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Utilisations
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Actif</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr
                  key={c.id}
                  className={[
                    "border-b border-gray-100 last:border-0",
                    !c.active ? "opacity-40" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 font-mono font-bold text-brand">{c.code}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.discount_amount > 0 && (
                      <span className="mr-2">−{c.discount_amount} €</span>
                    )}
                    {c.free_option_ids.length > 0 && (
                      <span className="text-green-700">
                        {c.free_option_ids.length} option
                        {c.free_option_ids.length > 1 ? "s" : ""} offerte
                        {c.free_option_ids.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.event_valid_from || c.event_valid_until
                      ? `${fmtDate(c.event_valid_from)} → ${fmtDate(c.event_valid_until)}`
                      : "Toutes dates"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.allowed_region_ids?.length
                      ? c.allowed_region_ids.map(regionName).join(", ")
                      : c.allowed_pr_slugs?.length
                        ? `${c.allowed_pr_slugs.length} PR`
                        : "Partout"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {c.uses_count}
                    {c.max_uses !== null ? ` / ${c.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <PromoToggle id={c.id} active={c.active} code={c.code} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
