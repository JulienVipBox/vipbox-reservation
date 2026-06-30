import { createClient } from "@supabase/supabase-js";

// Client admin (service_role key) — serveur uniquement, ne jamais exposer côté client
// Bypass les règles RLS : à utiliser uniquement dans les API routes / Server Actions
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
