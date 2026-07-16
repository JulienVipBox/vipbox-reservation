import { NextRequest, NextResponse } from "next/server";
import { checkModelsAvailability } from "@/lib/availability";
import { V1_MODEL_SLUGS, type V1ModelSlug, type PickupPoint } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { pickupPoint, eventDate, modelSlugs } = await req.json();

    if (!pickupPoint?.slug || !eventDate || !Array.isArray(modelSlugs)) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const validSlugs = modelSlugs.filter((s: unknown): s is V1ModelSlug =>
      V1_MODEL_SLUGS.includes(s as V1ModelSlug),
    );

    const availability = await checkModelsAvailability(
      pickupPoint as PickupPoint,
      String(eventDate),
      validSlugs,
    );

    return NextResponse.json({ availability });
  } catch (err) {
    console.error("[availability] route error:", err);
    // Panne de la vérification → tout disponible plutôt que de bloquer le tunnel
    return NextResponse.json({ availability: {} });
  }
}
