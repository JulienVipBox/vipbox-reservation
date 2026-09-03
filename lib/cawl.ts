// SERVER-SIDE ONLY — ne jamais importer depuis un composant client
//
// Intégration CAWL (Crédit Agricole / Worldline), mode Hosted Checkout Page.
// Package npm réel : `onlinepayments-sdk-nodejs` (voir CONTEXT.md, section
// Paiement, pour le détail du flux et la façon dont les identifiants ont été
// obtenus/vérifiés).
import sdk from "onlinepayments-sdk-nodejs";

const CAWL_HOST = process.env.CAWL_HOST;
const CAWL_API_KEY_ID = process.env.CAWL_API_KEY_ID;
const CAWL_SECRET_API_KEY = process.env.CAWL_SECRET_API_KEY;
const CAWL_PSPID = process.env.CAWL_PSPID;

function getClient() {
  if (!CAWL_HOST || !CAWL_API_KEY_ID || !CAWL_SECRET_API_KEY || !CAWL_PSPID) {
    throw new Error("Configuration CAWL incomplète (variables d'env manquantes)");
  }
  return sdk.init({
    integrator: "VIPBOX",
    host: CAWL_HOST,
    scheme: "https",
    port: 443,
    apiKeyId: CAWL_API_KEY_ID,
    secretApiKey: CAWL_SECRET_API_KEY,
  });
}

/**
 * Crée une session de paiement CAWL (Hosted Checkout Page) pour une
 * réservation. `merchantReference` est tagué avec l'UUID Supabase de la
 * réservation, ce qui permet de la retrouver depuis un événement webhook.
 * `null` en cas d'échec (jamais d'exception) — au serveur appelant de
 * décider quoi afficher au client.
 */
export async function createCawlCheckout(params: {
  reservationId: string;
  totalAmount: number; // en euros
  returnUrl: string;
}): Promise<{ hostedCheckoutId: string; redirectUrl: string } | null> {
  try {
    const client = getClient();
    const res = await client.hostedCheckout.createHostedCheckout(CAWL_PSPID!, {
      order: {
        amountOfMoney: {
          // CAWL attend le montant en centimes (vérifié empiriquement).
          amount: Math.round(params.totalAmount * 100),
          currencyCode: "EUR",
        },
        references: { merchantReference: params.reservationId },
      },
      hostedCheckoutSpecificInput: {
        returnUrl: params.returnUrl,
        locale: "fr-FR",
        allowedNumberOfPaymentAttempts: 3,
        // `sessionTimeout` volontairement omis : une valeur en secondes
        // (ex. 3600) est rejetée par l'API ("INVALID_VALUE"), vérifié
        // empiriquement — laisser la valeur par défaut du prestataire (~3h).
      },
    });

    if (!res.isSuccess || !res.body.hostedCheckoutId || !res.body.redirectUrl) {
      console.error("[CAWL] createHostedCheckout a échoué:", JSON.stringify(res.body));
      return null;
    }

    return { hostedCheckoutId: res.body.hostedCheckoutId, redirectUrl: res.body.redirectUrl };
  } catch (err) {
    console.error("[CAWL] createCawlCheckout erreur:", err);
    return null;
  }
}

export type CawlPaymentResult = "paid" | "pending" | "failed" | "unknown";

/**
 * Interroge le statut réel d'une session de paiement.
 *
 * ⚠️ Le mapping `paymentStatusCategory` → résultat est basé sur la
 * documentation et les conventions Worldline habituelles (`SUCCESSFUL` pour
 * un paiement abouti), mais seul le cas "pas encore de paiement" a pu être
 * vérifié empiriquement (retourne `IN_PROGRESS`, `createdPaymentOutput: {}`)
 * avant la mise en place du webhook. À confirmer avec un vrai paiement de
 * test (carte de test CAWL) avant la mise en prod définitive.
 */
export async function getCawlCheckoutResult(hostedCheckoutId: string): Promise<CawlPaymentResult> {
  try {
    const client = getClient();
    const res = await client.hostedCheckout.getHostedCheckout(CAWL_PSPID!, hostedCheckoutId);

    if (!res.isSuccess) {
      console.error("[CAWL] getHostedCheckout a échoué:", JSON.stringify(res.body));
      return "unknown";
    }

    const category = res.body.createdPaymentOutput?.paymentStatusCategory;
    if (category === "SUCCESSFUL") return "paid";
    if (category === "REJECTED") return "failed";
    if (category) return "pending"; // PENDING_COMPLETION, PENDING_MERCHANT, etc.

    // Pas encore de paiement créé sur cette session.
    if (res.body.status === "IN_PROGRESS") return "pending";
    return "failed"; // session terminée (expirée, annulée...) sans paiement abouti
  } catch (err) {
    console.error("[CAWL] getCawlCheckoutResult erreur:", err);
    return "unknown";
  }
}
