import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ReservationTable } from "./ReservationTable";
import { ExportButton } from "./ExportButton";

export const metadata: Metadata = { title: "Réservations" };

// Page de suivi des commandes en direct : sans ceci, Next.js met en cache le
// rendu de cette page côté serveur (Data Cache App Router) à chaque
// déploiement — une réservation créée après le dernier déploiement resterait
// invisible ici jusqu'au déploiement suivant, sans que le "no-store" du
// middleware (qui ne concerne que la mise en cache navigateur) n'y change
// rien. Bug réel constaté le 2026-09-03 : une réservation payée absente de
// cette page. Même correctif que /admin/disponibilites (voir ce fichier).
export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { data } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const reservations = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Réservations</h1>
        <ExportButton reservations={reservations} />
      </div>
      <ReservationTable reservations={reservations} />
    </div>
  );
}
