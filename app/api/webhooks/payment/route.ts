import { NextRequest, NextResponse } from "next/server";
import { handleSuccessfulPayment } from "@/lib/payment-handler";

// TODO: remplacer par la vérification de signature du prestataire retenu
// Stripe  : stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
// Up2Pay  : vérification HMAC selon doc CA CAWL
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // ── À remplacer par la logique du prestataire ──────────────────────────────
  // Exemple Stripe :
  // const event = stripe.webhooks.constructEvent(...);
  // if (event.type !== "payment_intent.succeeded") return NextResponse.json({ received: true });
  // const reservationId = event.data.object.metadata.reservationId;
  // const paymentIntentId = event.data.object.id;
  // ─────────────────────────────────────────────────────────────────────────

  // Placeholder — à remplacer
  const { reservationId, paymentIntentId } = body as {
    reservationId?: string;
    paymentIntentId?: string;
  };

  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }

  try {
    await handleSuccessfulPayment(reservationId, paymentIntentId);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Payment webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
