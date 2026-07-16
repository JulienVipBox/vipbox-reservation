// Raw WP API shape — used only in lib/wordpress.ts
export type WPPickupPoint = {
  id: number;
  slug: string;
  title: { rendered: string };
  adresse: string;
  code_postal: string;
  commune_reelle: string;
  adresse_complete: string;
  latitude: string;
  longitude: string;
  horaires: string;
  telephone: string;
  region: number[]; // WP taxonomy term IDs
  modeles_disponibles: Array<{
    ID: number;
    post_name: string;
    post_title: string;
  }>;
  // Lien explicite vers point_retrait.ID côté CRM (remplace le rapprochement
  // par code postal, non fiable — voir lib/wordpress.ts)
  id_base: string | null;
};

// V1 model slugs — source of truth
export const V1_MODEL_SLUGS = [
  "vipbox-classic",
  "smart",
  "spinner-360",
] as const;
export type V1ModelSlug = (typeof V1_MODEL_SLUGS)[number];

// Normalized pickup point (used in store + UI)
export type PickupPoint = {
  id: number;
  slug: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  fullAddress: string;
  lat: number;
  lng: number;
  horaires: string;
  phone: string;
  availableModelSlugs: V1ModelSlug[];
  regionIds: number[]; // WP taxonomy region IDs
  distanceKm?: number;
  // CRM serveurdms.com — enrichis côté serveur à partir du code postal
  crmId?: number;
  crmChefProjetId?: number;
  crmProgrammateurId?: number;
};

// Promo code — Supabase table shape
export type PromoCode = {
  id: string;
  code: string;
  discount_amount: number;
  free_option_ids: string[];
  booking_valid_from: string | null;
  booking_valid_until: string | null;
  event_valid_from: string | null;
  event_valid_until: string | null;
  allowed_pr_slugs: string[] | null;
  allowed_region_ids: number[] | null;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_user: number;
  allowed_emails: string[] | null;
  active: boolean;
  created_at: string;
};

export type PhotoboothModel = {
  slug: V1ModelSlug;
  name: string;
  description: string;
  price: number;
};

export type Option = {
  id: string;
  name: string;
  description?: string;
  price: number;
};

export type CustomerInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
};
