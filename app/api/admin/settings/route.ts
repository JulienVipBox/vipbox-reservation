import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie, COOKIE_NAME } from "@/lib/admin-auth";
import { getSetting, setSetting } from "@/lib/settings";

const ALLOWED_KEYS = [
  "email_internal_recipients",
  "email_client_subject",
  "email_client_intro",
] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

async function auth(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value ?? "";
  return cookie ? verifySessionCookie(cookie) : false;
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const result: Record<string, string | null> = {};
  await Promise.all(
    ALLOWED_KEYS.map(async (key) => {
      result[key] = await getSetting(key).catch(() => null);
    }),
  );
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const updates: [SettingKey, string][] = [];

  for (const key of ALLOWED_KEYS) {
    if (key in body && typeof body[key] === "string") {
      updates.push([key, body[key]]);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Aucun champ valide" }, { status: 400 });
  }

  await Promise.all(updates.map(([key, value]) => setSetting(key, value)));
  return NextResponse.json({ ok: true });
}
