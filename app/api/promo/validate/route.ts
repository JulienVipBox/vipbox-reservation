import { NextRequest, NextResponse } from "next/server";
import { validatePromoCode } from "@/lib/promo";

export async function POST(req: NextRequest) {
  try {
    const { code, eventDate, prSlug, prRegionIds, customerEmail } = await req.json();

    if (!code || !eventDate || !prSlug) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const effect = await validatePromoCode({
      code,
      eventDate,
      prSlug,
      prRegionIds: prRegionIds ?? [],
      customerEmail,
    });

    if (!effect) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    return NextResponse.json({ valid: true, effect });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
