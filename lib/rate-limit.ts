import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Limite de débit anti-spam, sur le même principe que le formulaire de contact
 * WP (includes/rate-limit.php) : compte les tentatives par "bucket" (IP ou
 * email) sur une fenêtre glissante, stockées dans la table Supabase
 * rate_limit_hits (pas de mémoire partagée fiable entre invocations
 * serverless Vercel, contrairement aux transients WordPress).
 *
 * @returns true si l'action est autorisée (et compte comme une tentative de plus).
 */
export async function checkRateLimit(
  bucket: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  await supabaseAdmin
    .from("rate_limit_hits")
    .delete()
    .eq("bucket", bucket)
    .lt("created_at", windowStart);

  const { count } = await supabaseAdmin
    .from("rate_limit_hits")
    .select("*", { count: "exact", head: true })
    .eq("bucket", bucket);

  if ((count ?? 0) >= maxAttempts) {
    return false;
  }

  await supabaseAdmin.from("rate_limit_hits").insert({ bucket });
  return true;
}
