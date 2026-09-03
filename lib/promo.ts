// SERVER-SIDE ONLY — ne jamais importer depuis un composant client
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OPTION_PRICE_LOOKUP } from "@/lib/models";
import type { PromoCode } from "@/types";
import type { PromoEffect } from "@/lib/store";

export type { PromoCode };

function today(): string {
  return new Date().toISOString().substring(0, 10);
}

function isGeoValid(pc: PromoCode, prSlug: string, prRegionIds: number[]): boolean {
  const hasPrRestriction = pc.allowed_pr_slugs && pc.allowed_pr_slugs.length > 0;
  const hasRegionRestriction = pc.allowed_region_ids && pc.allowed_region_ids.length > 0;
  if (!hasPrRestriction && !hasRegionRestriction) return true;
  if (hasPrRestriction && pc.allowed_pr_slugs!.includes(prSlug)) return true;
  if (hasRegionRestriction && pc.allowed_region_ids!.some((r) => prRegionIds.includes(r))) return true;
  return false;
}

function isDatesValid(pc: PromoCode, eventDate: string, bookingDate: string): boolean {
  if (pc.event_valid_from && eventDate < pc.event_valid_from) return false;
  if (pc.event_valid_until && eventDate > pc.event_valid_until) return false;
  if (pc.booking_valid_from && bookingDate < pc.booking_valid_from) return false;
  if (pc.booking_valid_until && bookingDate > pc.booking_valid_until) return false;
  return true;
}

export async function validatePromoCode(params: {
  code: string;
  eventDate: string;
  prSlug: string;
  prRegionIds: number[];
  customerEmail?: string;
  bookingDate?: string;
}): Promise<PromoEffect | null> {
  const { code, eventDate, prSlug, prRegionIds, customerEmail } = params;
  const bookingDate = params.bookingDate ?? today();

  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .single();

  if (error || !data) return null;
  const pc = data as PromoCode;

  if (!isDatesValid(pc, eventDate, bookingDate)) return null;
  if (pc.max_uses !== null && pc.uses_count >= pc.max_uses) return null;
  if (!isGeoValid(pc, prSlug, prRegionIds)) return null;

  // Email targeting (skip check if email not yet known)
  if (customerEmail && pc.allowed_emails && pc.allowed_emails.length > 0) {
    const email = customerEmail.toLowerCase().trim();
    if (!pc.allowed_emails.map((e) => e.toLowerCase().trim()).includes(email)) return null;
  }

  // Per-user quota (only if email known and a limit is actually set — null =
  // illimité, même convention que max_uses)
  if (customerEmail && pc.max_uses_per_user !== null && pc.max_uses_per_user > 0) {
    const { count } = await supabaseAdmin
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("promo_code", pc.code)
      .eq("customer_email", customerEmail.toLowerCase().trim())
      .in("status", ["payé", "en_attente"]);

    if (count !== null && count >= pc.max_uses_per_user) return null;
  }

  return { discountAmount: pc.discount_amount, freeOptionIds: pc.free_option_ids };
}

function promoValue(pc: PromoCode): number {
  return pc.discount_amount + pc.free_option_ids.reduce(
    (sum, id) => sum + (OPTION_PRICE_LOOKUP[id] ?? 0),
    0,
  );
}

export async function getBestAutoPromoCode(params: {
  eventDate: string;
  prSlug: string;
  prRegionIds: number[];
}): Promise<{ code: string; effect: PromoEffect } | null> {
  const { eventDate, prSlug, prRegionIds } = params;
  const bookingDate = today();

  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("active", true);

  if (error || !data || data.length === 0) return null;

  let best: { code: string; effect: PromoEffect; value: number } | null = null;

  for (const row of data as PromoCode[]) {
    if (!isDatesValid(row, eventDate, bookingDate)) continue;
    if (row.max_uses !== null && row.uses_count >= row.max_uses) continue;
    if (!isGeoValid(row, prSlug, prRegionIds)) continue;

    const value = promoValue(row);
    if (!best || value > best.value) {
      best = {
        code: row.code,
        effect: { discountAmount: row.discount_amount, freeOptionIds: row.free_option_ids },
        value,
      };
    }
  }

  return best ? { code: best.code, effect: best.effect } : null;
}
