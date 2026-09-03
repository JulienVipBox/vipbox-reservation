import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCawlCheckoutResult } from "@/lib/cawl";
import { handleSuccessfulPayment } from "@/lib/payment-handler";

// Page où CAWL redirige le client après paiement (returnUrl passée à la
// création de la session, voir app/api/cawl/create-checkout/route.ts).
// C'est la confirmation "principale" côté client — le webhook
// (app/api/webhooks/payment/route.ts) reste un filet de sécurité pour le cas
// où le client ferme l'onglet avant de revenir.
export default async function PaiementRetourPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect("/reservation/date");

  const { data: r } = await supabaseAdmin
    .from("reservations")
    .select("id, status, stripe_payment_intent_id")
    .eq("id", id)
    .single();

  if (!r) redirect("/reservation/date");

  // Déjà confirmée (webhook plus rapide que le retour client, ou rechargement
  // de cette page) — pas besoin de re-vérifier auprès de CAWL.
  if (r.status === "payé") {
    redirect(`/reservation/confirmation?id=${r.id}`);
  }

  if (!r.stripe_payment_intent_id) {
    return <RetourMessage type="failed" />;
  }

  const result = await getCawlCheckoutResult(r.stripe_payment_intent_id);

  if (result === "paid") {
    // handleSuccessfulPayment() est idempotent (voir lib/payment-handler.ts)
    // — pas de risque de double envoi d'e-mails si le webhook a déjà traité
    // cette réservation entre-temps.
    await handleSuccessfulPayment(r.id);
    redirect(`/reservation/confirmation?id=${r.id}`);
  }

  if (result === "pending") {
    return <RetourMessage type="pending" reservationId={r.id} />;
  }

  // "failed" ou "unknown" — on ne bloque pas indéfiniment, on permet de
  // réessayer plutôt que de laisser la réservation en_attente pour toujours.
  await supabaseAdmin
    .from("reservations")
    .update({ status: "échoué" })
    .eq("id", r.id)
    .eq("status", "en_attente");

  return <RetourMessage type="failed" />;
}

function RetourMessage({
  type,
  reservationId,
}: {
  type: "pending" | "failed";
  reservationId?: string;
}) {
  if (type === "pending") {
    return (
      <div className="max-w-md mx-auto space-y-5 text-center py-10">
        <h1 className="text-xl font-bold text-gray-900">Paiement en cours de traitement</h1>
        <p className="text-sm text-gray-600">
          Votre paiement est toujours en cours de vérification par notre prestataire bancaire.
          Cela peut prendre quelques instants.
        </p>
        <a
          href={`/reservation/paiement/retour?id=${reservationId}`}
          className="inline-flex items-center gap-2 rounded-[5px] bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          Rafraîchir
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-5 text-center py-10">
      <h1 className="text-xl font-bold text-gray-900">Le paiement n&apos;a pas abouti</h1>
      <p className="text-sm text-gray-600">
        Votre carte n&apos;a pas été débitée. Vous pouvez réessayer ou nous contacter si le
        problème persiste.
      </p>
      <a
        href="/reservation/paiement"
        className="inline-flex items-center gap-2 rounded-[5px] bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
      >
        Réessayer
      </a>
    </div>
  );
}
