import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie, COOKIE_NAME } from "@/lib/admin-auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Seules les routes /admin/* sont protégées
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // La page de login est publique
  if (pathname === "/admin/login") return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value ?? "";
  const valid = cookie ? await verifySessionCookie(cookie) : false;

  if (!valid) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    return NextResponse.redirect(loginUrl);
  }

  // L'admin affiche des données live (CRM, réservations...) — Next.js en dev
  // envoie "no-cache" sans "no-store", ce que certains navigateurs traitent
  // encore comme réutilisable sur un simple F5 (un rechargement forcé
  // fonctionne, lui). On force "no-store" pour lever toute ambiguïté.
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
