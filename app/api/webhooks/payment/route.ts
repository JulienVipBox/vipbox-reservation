import { NextRequest, NextResponse } from "next/server";
import sdk from "onlinepayments-sdk-nodejs";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { handleSuccessfulPayment } from "@/lib/payment-handler";

// Filet de sécurité : app/reservation/paiement/retour/page.tsx est la
// confirmation "principale" (vérification server-to-server avec nos propres
// identifiants dès le retour du client) ; ce webhook couvre le cas où le
// client ferme l'onglet avant d'y revenir.
//
// Clé webhook CAWL distincte des identifiants d'API utilisés pour créer les
// sessions — à récupérer par Julien dans le portail marchand (onglet
// Développeur → Webhooks), pas encore fait au moment de l'écriture de ce
// fichier. Tant que CAWL_WEBHOOK_KEY_ID/CAWL_WEBHOOK_SECRET_KEY ne sont pas
// renseignés, la route rejette tout événement plutôt que de faire confiance
// à un payload non vérifié (contrairement au reste du tunnel, on ne "fail
// open" jamais sur un événement de paiement — un faux positif ici veut dire
// livrer une réservation gratuite).
const webhookKeyId = process.env.CAWL_WEBHOOK_KEY_ID;
const webhookSecretKey = process.env.CAWL_WEBHOOK_SECRET_KEY;

if (webhookKeyId && webhookSecretKey) {
  sdk.webhooks.inMemorySecretKeyStore.storeSecretKey(webhookKeyId, webhookSecretKey);
}

const webhooksHelper = sdk.webhooks.init({
  getSecretKey: (keyId: string) => sdk.webhooks.inMemorySecretKeyStore.getSecretKey(keyId),
});

export async function POST(request: NextRequest) {
  if (!webhookKeyId || !webhookSecretKey) {
    console.error("[webhook] CAWL_WEBHOOK_KEY_ID/CAWL_WEBHOOK_SECRET_KEY absents — événement rejeté.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Corps brut nécessaire à la vérification de signature — jamais
  // request.json() ici (même principe que Stripe, voir commentaire
  // précédent de ce fichier).
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event;
  try {
    event = await webhooksHelper.unmarshal(rawBody, headers);
  } catch (err) {
    console.error("[webhook] Signature invalide ou payload malformé:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const hostedCheckoutId = event.payment?.hostedCheckoutSpecificOutput?.hostedCheckoutId;
  const statusCategory = event.payment?.statusOutput?.statusCategory;

  // Rien à faire pour les événements qui ne concernent pas un paiement
  // abouti (mêmes valeurs que lib/cawl.ts::getCawlCheckoutResult) — on
  // accuse quand même réception pour que CAWL ne réessaie pas indéfiniment.
  if (!hostedCheckoutId || statusCategory !== "SUCCESSFUL") {
    return NextResponse.json({ received: true });
  }

  const { data: r } = await supabaseAdmin
    .from("reservations")
    .select("id")
    .eq("stripe_payment_intent_id", hostedCheckoutId)
    .single();

  if (!r) {
    console.error("[webhook] Aucune réservation pour hostedCheckoutId:", hostedCheckoutId);
    return NextResponse.json({ received: true });
  }

  try {
    await handleSuccessfulPayment(r.id);
  } catch (err) {
    console.error("[webhook] handleSuccessfulPayment a échoué:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
