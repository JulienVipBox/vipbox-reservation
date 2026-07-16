import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ReservationTable } from "./ReservationTable";

export const metadata: Metadata = { title: "Réservations" };

export default async function ReservationsPage() {
  const { data } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Réservations</h1>
      <ReservationTable reservations={data ?? []} />
    </div>
  );
}
