import type { PickupPoint } from "@/types";

export type GeocodingResult = {
  lat: number;
  lng: number;
  label: string;
};

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodingResult | null> {
  const res = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates as [number, number];
  return { lat, lng, label: feature.properties.label as string };
}

export function findNearestPickupPoints(
  userLat: number,
  userLng: number,
  points: PickupPoint[],
  limit = 3,
): PickupPoint[] {
  return points
    .filter((p) => p.availableModelSlugs.length > 0)
    .map((p) => ({
      ...p,
      distanceKm: haversineKm(userLat, userLng, p.lat, p.lng),
    }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .slice(0, limit);
}
