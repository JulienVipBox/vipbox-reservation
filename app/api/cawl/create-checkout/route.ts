import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createCawlCheckout } from "@/lib/cawl";

export async function POST(request: NextRequest) {
  const { reservationId } = await request.json().catch(() => ({}));

  if (!reservationId) {
    return NextResponse.json({ error: "reservationId requis" }, { status: 400 });
  }

  const { data: r, error } = await supabaseAdmin
    .from("reservations")
    .select("id, status, total_amount")
    .eq("id", reservationId)
    .single();

  if (error || !r) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  // Le montant vient de la ligne déjà enregistrée (recalculé côté serveur à
  // la création, voir app/api/reservations/route.ts) — jamais du client à
  // cette étape.
  if (r.status !== "en_attente") {
    return NextResponse.json(
      { error: "Cette réservation n'est plus en attente de paiement." },
      { status: 409 },
    );
  }

  const returnUrl = `${request.nextUrl.origin}/reservation/paiement/retour?id=${r.id}`;

  const checkout = await createCawlCheckout({
    reservationId: r.id,
    totalAmount: r.total_amount,
    returnUrl,
  });

  if (!checkout) {
    return NextResponse.json(
      { error: "Impossible de démarrer le paiement pour le moment. Merci de réessayer." },
      { status: 502 },
    );
  }

  // Réutilise le champ `stripe_payment_intent_id` (whitelist déjà existante
  // sur PATCH /api/reservations) pour stocker l'identifiant CAWL — pas de
  // changement de schéma Supabase. Écrit directement via le client admin
  // (cette route est déjà côté serveur de confiance).
  await supabaseAdmin
    .from("reservations")
    .update({ stripe_payment_intent_id: checkout.hostedCheckoutId })
    .eq("id", r.id);

  return NextResponse.json({ redirectUrl: checkout.redirectUrl });
}
