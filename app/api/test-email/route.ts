// ⚠️ ENDPOINT DE TEST — À SUPPRIMER AVANT LA MISE EN PRODUCTION
// Usage: POST /api/test-email { "reservationId": "uuid-supabase" }
import { NextRequest, NextResponse } from "next/server";
import { handleSuccessfulPayment } from "@/lib/payment-handler";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { reservationId } = await request.json().catch(() => ({}));

  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }

  try {
    await handleSuccessfulPayment(reservationId);
    return NextResponse.json({ ok: true, message: "Emails envoyés" });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
