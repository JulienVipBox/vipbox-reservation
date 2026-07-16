import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie, COOKIE_NAME } from "@/lib/admin-auth";
import {
  CAPACITY_FIELDS,
  updateCrmPickupPointCapacity,
  type CapacityField,
} from "@/lib/crm";

async function auth(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value ?? "";
  return cookie ? verifySessionCookie(cookie) : false;
}

// PATCH — met à jour une capacité (un modèle, un PR) côté CRM
export async function PATCH(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const crmId = Number(body.crmId);
  const field = body.field as string;
  const value = Number(body.value);

  if (!Number.isInteger(crmId)) {
    return NextResponse.json({ error: "crmId invalide" }, { status: 400 });
  }
  if (!(CAPACITY_FIELDS as readonly string[]).includes(field)) {
    return NextResponse.json({ error: "Champ non autorisé" }, { status: 400 });
  }
  if (!Number.isInteger(value) || value < 0) {
    return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });
  }

  try {
    await updateCrmPickupPointCapacity(crmId, field as CapacityField, value);
  } catch (err) {
    console.error("[admin/disponibilites] update failed:", err);
    return NextResponse.json({ error: "Échec de mise à jour CRM" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
