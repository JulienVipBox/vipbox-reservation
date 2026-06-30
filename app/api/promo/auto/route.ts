import { NextRequest, NextResponse } from "next/server";
import { getBestAutoPromoCode } from "@/lib/promo";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventDate = searchParams.get("eventDate");
    const prSlug = searchParams.get("prSlug");
    const regionIds = searchParams
      .getAll("regionIds")
      .map(Number)
      .filter((n) => !isNaN(n));

    if (!eventDate || !prSlug) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const result = await getBestAutoPromoCode({
      eventDate,
      prSlug,
      prRegionIds: regionIds,
    });

    return NextResponse.json(result ?? null);
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
