import { createClient } from "@supabase/supabase-js";

// Client public (anon key) — utilisable côté client et serveur pour les lectures
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
