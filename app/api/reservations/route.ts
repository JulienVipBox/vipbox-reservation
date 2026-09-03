import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rate-limit";
import { validatePromoCode } from "@/lib/promo";
import { getModelPrice, getModelName, getOptionsForModel } from "@/lib/models";
import { V1_MODEL_SLUGS, type V1ModelSlug } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEventDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d >= new Date().toISOString().substring(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const humanVerified = await verifyTurnstileToken(body.turnstileToken, ip);
    if (!humanVerified) {
      return NextResponse.json(
        { error: "Vérification anti-spam échouée." },
        { status: 400 },
      );
    }

    // Anti-spam volumétrique par IP (5 réservations / heure).
    const ipAllowed = await checkRateLimit(`ip_submit_${ip}`, 5, 60 * 60);
    if (!ipAllowed) {
      return NextResponse.json(
        {
          error:
            "Trop de réservations envoyées depuis cette connexion. Merci de réessayer plus tard ou de nous contacter par téléphone.",
        },
        { status: 429 },
      );
    }

    // Anti-harcèlement : empêche d'utiliser le formulaire pour spammer une
    // même adresse e-mail depuis des IP différentes (3 réservations / jour).
    const email = String(body.customer_email ?? "").trim().toLowerCase();
    const emailAllowed = await checkRateLimit(
      `email_submit_${email}`,
      3,
      24 * 60 * 60,
    );
    if (!emailAllowed) {
      return NextResponse.json(
        {
          error:
            "Une réservation a déjà été enregistrée récemment avec cette adresse e-mail. Merci de patienter avant de réessayer, ou de nous contacter par téléphone.",
        },
        { status: 429 },
      );
    }

    // ── Coordonnées client : validées côté serveur (miroir de la validation
    // côté client dans CoordonneesForm.tsx — un POST direct sans passer par
    // le formulaire ne doit pas pouvoir insérer des champs vides/invalides).
    const firstName = String(body.customer_first_name ?? "").trim();
    const lastName = String(body.customer_last_name ?? "").trim();
    const phone = String(body.customer_phone ?? "").trim();
    const address = String(body.customer_address ?? "").trim();
    const postalCode = String(body.customer_postal_code ?? "").trim();
    const city = String(body.customer_city ?? "").trim();

    if (
      !firstName ||
      !lastName ||
      !phone ||
      !address ||
      !postalCode ||
      !city ||
      !EMAIL_RE.test(email)
    ) {
      return NextResponse.json(
        { error: "Coordonnées invalides ou incomplètes." },
        { status: 400 },
      );
    }

    const eventDate = String(body.event_date ?? "");
    if (!isValidEventDate(eventDate)) {
      return NextResponse.json(
        { error: "Date d'événement invalide." },
        { status: 400 },
      );
    }

    // ── Prix, options et remise recalculés côté serveur — jamais depuis le
    // navigateur, pour empêcher un montant trafiqué (ex. total_amount
    // modifié à la main dans une requête directe) d'être inséré en base.
    const modelSlug = String(body.model_slug ?? "");
    if (!V1_MODEL_SLUGS.includes(modelSlug as V1ModelSlug)) {
      return NextResponse.json({ error: "Modèle invalide." }, { status: 400 });
    }
    const modelName = getModelName(modelSlug)!;
    const modelPrice = getModelPrice(modelSlug, eventDate);

    const catalogue = getOptionsForModel(modelSlug as V1ModelSlug);
    const selectedOptionIds: string[] = Array.isArray(body.selected_option_ids)
      ? body.selected_option_ids.filter((id: unknown) => typeof id === "string")
      : [];
    if (selectedOptionIds.some((id) => !catalogue.some((o) => o.id === id))) {
      return NextResponse.json({ error: "Option invalide." }, { status: 400 });
    }

    const promoCodeInput = body.promo_code ? String(body.promo_code).trim() : null;
    const effect = promoCodeInput
      ? await validatePromoCode({
          code: promoCodeInput,
          eventDate,
          prSlug: String(body.pickup_point_slug ?? ""),
          prRegionIds: Array.isArray(body.pickup_point_region_ids)
            ? body.pickup_point_region_ids
            : [],
          customerEmail: email,
        })
      : null;
    // Code invalide/expiré entre l'affichage et la soumission → ignoré
    // silencieusement plutôt que de faire échouer toute la réservation.
    const finalPromoCode = effect ? promoCodeInput : null;
    const discount = effect?.discountAmount ?? 0;
    const freeOptionIds = effect?.freeOptionIds ?? [];

    // Un ID explicitement choisi par le client compte comme payant même s'il
    // est aussi éligible à l'offre — évite tout double-comptage, et ne peut
    // jouer qu'en défaveur d'une tentative de manipulation.
    const paidOptions = catalogue.filter((o) => selectedOptionIds.includes(o.id));
    const freeOptions = catalogue.filter(
      (o) => freeOptionIds.includes(o.id) && !selectedOptionIds.includes(o.id),
    );
    const optionsTotal = paidOptions.reduce((s, o) => s + o.price, 0);
    const allOptions = [
      ...freeOptions.map((o) => `${o.name} (Offert)`),
      ...paidOptions.map((o) => `${o.name} (${o.price} €)`),
    ];

    const totalAmount = Math.max(0, modelPrice + optionsTotal - discount);

    const reservation = {
      status: "en_attente",
      event_date: eventDate,
      pickup_point_name: String(body.pickup_point_name ?? ""),
      pickup_point_slug: body.pickup_point_slug ?? null,
      pickup_point_full_address: body.pickup_point_full_address ?? null,
      pickup_point_horaires: body.pickup_point_horaires ?? null,
      pickup_point_phone: body.pickup_point_phone ?? null,
      model_name: modelName,
      model_slug: modelSlug,
      model_price: modelPrice,
      options: allOptions.length === 0 ? null : allOptions.join(", "),
      option_ids: [...paidOptions.map((o) => o.id), ...freeOptions.map((o) => o.id)],
      promo_code: finalPromoCode,
      promo_discount: discount > 0 ? discount : null,
      total_amount: totalAmount,
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_email: email,
      customer_phone: phone,
      customer_address: address,
      customer_postal_code: postalCode,
      customer_city: city,
    };

    const { data, error } = await supabaseAdmin
      .from("reservations")
      .insert(reservation)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Le code promo peut avoir été affiché comme valide plus tôt dans le
    // tunnel (étape Code promo, avant que l'e-mail client ne soit connu) puis
    // rejeté ici (ex. quota par e-mail déjà atteint, voir lib/promo.ts) — le
    // total réellement enregistré peut donc différer de celui affiché
    // jusqu'ici. On le signale explicitement au client plutôt que de le
    // laisser découvrir un montant différent silencieusement à l'étape
    // Paiement (voir CoordonneesForm.tsx).
    return NextResponse.json({
      id: data.id,
      totalAmount,
      promoCodeApplied: finalPromoCode,
      promoDiscountApplied: discount,
    });
  } catch (err) {
    console.error("Reservation API error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Champs modifiables via cette route publique : uniquement la référence de
// paiement (utile avant redirection vers le prestataire). Tout le reste
// (status, montants, coordonnées client...) ne doit passer que par un accès
// serveur de confiance (webhook de paiement → lib/payment-handler.ts), jamais
// par un endpoint accessible depuis le navigateur avec le seul UUID en main.
const PATCHABLE_FIELDS = ["stripe_payment_intent_id"] as const;

export async function PATCH(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID manquant" }, { status: 400 });
    }

    const disallowed = Object.keys(updates).filter(
      (key) => !PATCHABLE_FIELDS.includes(key as (typeof PATCHABLE_FIELDS)[number]),
    );
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: `Champs non autorisés : ${disallowed.join(", ")}` },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("reservations")
      .update(updates)
      .eq("id", id)
      // Une réservation déjà finalisée (payée ou échouée) ne doit plus
      // pouvoir être modifiée via cette route.
      .eq("status", "en_attente");

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reservation PATCH error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
