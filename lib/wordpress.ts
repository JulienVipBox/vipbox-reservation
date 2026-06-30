import https from "node:https";
import type { WPPickupPoint, PickupPoint, V1ModelSlug } from "@/types";
import { V1_MODEL_SLUGS } from "@/types";
import { getCrmPickupPoints, matchCrmPr } from "@/lib/crm";

const WP_API_BASE = "https://www.vip-box.fr/wp-json/wp/v2";

// vip-box.fr serves an incomplete SSL chain — Node.js can't verify it locally.
// On Vercel (production), the system CA store handles it fine so we use fetch + cache.
// In all other envs we fall back to node:https with rejectUnauthorized: false.
function getJson<T>(url: string): Promise<T> {
  if (process.env.NODE_ENV === "production") {
    return fetch(url, { next: { revalidate: 3600 } })
      .then((r) => {
        if (!r.ok) throw new Error(`WP API ${r.status}`);
        return r.json() as Promise<T>;
      });
  }

  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    https
      .get(
        {
          hostname,
          path: pathname + search,
          headers: { Accept: "application/json" },
          rejectUnauthorized: false,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()) as T);
            } catch (e) {
              reject(e);
            }
          });
        },
      )
      .on("error", reject);
  });
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizePrTitle(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/^Location\s+photobooth\s*/i, "VIPBOX ")
    .trim();
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePickupPoint(wp: WPPickupPoint): PickupPoint {
  const availableModelSlugs = (wp.modeles_disponibles ?? [])
    .map((m) => m.post_name)
    .filter((slug): slug is V1ModelSlug =>
      (V1_MODEL_SLUGS as readonly string[]).includes(slug),
    );

  return {
    id: wp.id,
    slug: wp.slug,
    name: normalizePrTitle(wp.title.rendered),
    address: wp.adresse ?? "",
    postalCode: wp.code_postal ?? "",
    city: wp.commune_reelle ?? "",
    fullAddress:
      wp.adresse_complete ||
      `${wp.adresse ?? ""}, ${wp.code_postal ?? ""} ${wp.commune_reelle ?? ""}`.trim(),
    lat: parseFloat(wp.latitude),
    lng: parseFloat(wp.longitude),
    horaires: stripHtml(wp.horaires ?? ""),
    phone: wp.telephone ?? "",
    availableModelSlugs,
    regionIds: wp.region ?? [],
  };
}

export async function getPickupPoints(): Promise<PickupPoint[]> {
  const [wpData, crmPrs] = await Promise.all([
    getJson<WPPickupPoint[]>(`${WP_API_BASE}/point_retrait?per_page=100`),
    getCrmPickupPoints(),
  ]);

  return wpData
    .map(normalizePickupPoint)
    .filter((pp) => !isNaN(pp.lat) && !isNaN(pp.lng))
    .map((pp) => {
      const crmPr = matchCrmPr(crmPrs, pp.postalCode);
      if (!crmPr) {
        console.warn(`[CRM] Aucun PR trouvé pour code_postal=${pp.postalCode} (${pp.name})`);
        return pp;
      }
      return {
        ...pp,
        crmId: crmPr.ID,
        crmChefProjetId: crmPr.commercial_id,
        crmProgrammateurId: crmPr.programmateur_vipbox,
      };
    });
}
