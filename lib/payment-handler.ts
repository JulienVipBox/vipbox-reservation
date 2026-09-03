// SERVER-SIDE ONLY — logique post-paiement (appelée par le webhook)
import { supabaseAdmin } from "./supabase-admin";
import { findOrCreateMonEspaceAccount } from "./monespace";
import {
  sendClientConfirmationEmail,
  sendInternalNotificationEmail,
  type ReservationEmailData,
} from "./email";

export async function handleSuccessfulPayment(
  supabaseReservationId: string,
  stripePaymentIntentId?: string,
): Promise<void> {
  // 1. Récupérer la réservation dans Supabase
  const { data: r, error } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .eq("id", supabaseReservationId)
    .single();

  if (error || !r) {
    throw new Error(`Reservation not found: ${supabaseReservationId}`);
  }

  // Idempotence : le webhook et la page de retour client (app/reservation/
  // paiement/retour) peuvent tous les deux appeler cette fonction pour la
  // même réservation (le premier arrivé gagne). Sans ce garde-fou, un appel
  // en double enverrait les 2 e-mails de confirmation deux fois.
  if (r.status === "payé") {
    console.log(`[payment-handler] Réservation ${supabaseReservationId} déjà traitée, appel ignoré.`);
    return;
  }

  // 2. Mettre à jour le statut
  await supabaseAdmin
    .from("reservations")
    .update({
      status: "payé",
      ...(stripePaymentIntentId && { stripe_payment_intent_id: stripePaymentIntentId }),
    })
    .eq("id", supabaseReservationId);

  // 3. TODO: Écriture CRM prestations (mapping à compléter après réception export CSV)
  // const crmId = await postToCrm(r);
  const crmId: number | null = null;

  // 4. Créer ou retrouver le compte mon-espace
  let monEspace;
  try {
    monEspace = await findOrCreateMonEspaceAccount(r.customer_email);
  } catch (err) {
    // Ne pas bloquer les emails si la création du compte échoue
    console.error("Mon-espace account error:", err);
    monEspace = { userId: 0, isNewUser: false };
  }

  // 5. TODO: Lier user_id dans la prestation CRM (une fois step 3 implémenté)
  // if (crmId && monEspace.userId) {
  //   await patchCrmPrestation(crmId, { user_id: monEspace.userId });
  // }

  // 6. Mettre à jour l'ID CRM dans Supabase si disponible
  if (crmId) {
    await supabaseAdmin
      .from("reservations")
      .update({ crm_prestation_id: crmId })
      .eq("id", supabaseReservationId);
  }

  // 7. Envoyer les emails
  const emailData: ReservationEmailData = {
    supabaseId: r.id,
    eventDate: r.event_date,
    pickupPointName: r.pickup_point_name,
    pickupPointFullAddress: r.pickup_point_full_address ?? null,
    pickupPointHoraires: r.pickup_point_horaires ?? null,
    pickupPointPhone: r.pickup_point_phone ?? null,
    modelName: r.model_name,
    modelPrice: r.model_price,
    options: r.options ?? null,
    promoCode: r.promo_code ?? null,
    promoDiscount: r.promo_discount ?? null,
    totalAmount: r.total_amount,
    firstName: r.customer_first_name,
    lastName: r.customer_last_name,
    email: r.customer_email,
    phone: r.customer_phone,
    address: r.customer_address,
    postalCode: r.customer_postal_code,
    city: r.customer_city,
    monEspace,
    crmPrestationId: crmId,
  };

  // Envoyer les deux emails en parallèle — une erreur sur l'un ne bloque pas l'autre
  const [clientResult, internalResult] = await Promise.allSettled([
    sendClientConfirmationEmail(emailData),
    sendInternalNotificationEmail(emailData),
  ]);

  if (clientResult.status === "rejected") {
    console.error("Client email error:", clientResult.reason);
  }
  if (internalResult.status === "rejected") {
    console.error("Internal email error:", internalResult.reason);
  }
}
