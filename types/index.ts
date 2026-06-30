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
  modeles_disponibles: Array<{
    ID: number;
    post_name: string;
    post_title: string;
  }>;
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
  distanceKm?: number;
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
