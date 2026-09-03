import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySessionCookie, COOKIE_NAME } from "@/lib/admin-auth";

async function auth(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value ?? "";
  return cookie ? verifySessionCookie(cookie) : false;
}

// GET — liste tous les codes promo
export async function GET(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — créer un code promo
export async function POST(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();

  // Sanitisation minimale
  const code = (body.code ?? "").toUpperCase().trim();
  if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

  if ((body.discount_amount ?? 0) === 0 && (body.free_option_ids ?? []).length === 0) {
    return NextResponse.json({ error: "Remise ou option offerte requise" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("promo_codes").insert({
    code,
    discount_amount: body.discount_amount ?? 0,
    free_option_ids: body.free_option_ids ?? [],
    booking_valid_from: body.booking_valid_from || null,
    booking_valid_until: body.booking_valid_until || null,
    event_valid_from: body.event_valid_from || null,
    event_valid_until: body.event_valid_until || null,
    allowed_pr_slugs: body.allowed_pr_slugs?.length ? body.allowed_pr_slugs : null,
    allowed_region_ids: body.allowed_region_ids?.length ? body.allowed_region_ids : null,
    max_uses: body.max_uses ? Number(body.max_uses) : null,
    max_uses_per_user: body.max_uses_per_user ? Number(body.max_uses_per_user) : null,
    allowed_emails: body.allowed_emails?.length ? body.allowed_emails : null,
    active: true,
  }).select().single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ce code existe déjà" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

// DELETE — supprimer un code
export async function DELETE(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const { error } = await supabaseAdmin.from("promo_codes").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH — activer / désactiver un code
export async function PATCH(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, active } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("promo_codes")
    .update({ active })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
