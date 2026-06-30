import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, COOKIE_NAME } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  const ok =
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD;

  if (!ok) {
    return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
  }

  const cookie = await createSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
