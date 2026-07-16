// SERVER-SIDE ONLY — ne jamais importer depuis un composant client
import https from "node:https";

const CRM_BASE = process.env.CRM_API_URL!;
const CRM_USER = process.env.CRM_API_USER!;
const CRM_PASS = process.env.CRM_API_PASSWORD!;

function basicAuth() {
  return "Basic " + Buffer.from(`${CRM_USER}:${CRM_PASS}`).toString("base64");
}

// Même stratégie SSL que lib/wordpress.ts :
// - prod (Vercel) : fetch standard, le CA system gère
// - dev : node:https avec rejectUnauthorized: false
// `fresh: true` désactive le cache 1h (utilisé pour l'admin des capacités,
// qui doit refléter une modification immédiatement après enregistrement).
function crmGet<T>(path: string, opts?: { fresh?: boolean }): Promise<T> {
  const url = `${CRM_BASE}${path}`;
  if (process.env.NODE_ENV === "production") {
    return fetch(url, {
      headers: { Authorization: basicAuth(), Accept: "application/json" },
      ...(opts?.fresh ? { cache: "no-store" } : { next: { revalidate: 3600 } }),
    }).then((r) => r.json() as Promise<T>);
  }
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    https
      .get(
        {
          hostname,
          path: pathname + search,
          headers: { Authorization: basicAuth(), Accept: "application/json" },
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

function crmPost(path: string, body: Record<string, unknown>): Promise<number> {
  const url = `${CRM_BASE}${path}`;
  const bodyStr = JSON.stringify(body);
  if (process.env.NODE_ENV === "production") {
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: basicAuth(),
        "Content-Type": "application/json",
      },
      body: bodyStr,
    }).then((r) => r.json() as Promise<number>);
  }
  return new Promise((resolve, reject) => {
    const { hostname, pathname } = new URL(url);
    const req = https.request(
      {
        hostname,
        path: pathname,
        method: "POST",
        headers: {
          Authorization: basicAuth(),
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()) as number);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// php-crud-api n'a pas la convention REST habituelle : PATCH y déclenche une
// INCRÉMENTATION des champs numériques (valeur ajoutée à l'existante), et
// PUT fait le remplacement (mise à jour partielle classique). D'où l'usage
// de PUT ici pour un "set" — utiliser PATCH additionnerait silencieusement
// la nouvelle valeur à l'ancienne au lieu de la remplacer.
function crmPut(path: string, body: Record<string, unknown>): Promise<void> {
  const url = `${CRM_BASE}${path}`;
  const bodyStr = JSON.stringify(body);
  if (process.env.NODE_ENV === "production") {
    return fetch(url, {
      method: "PUT",
      headers: {
        Authorization: basicAuth(),
        "Content-Type": "application/json",
      },
      body: bodyStr,
    }).then((r) => {
      if (!r.ok) throw new Error(`CRM PUT ${r.status}`);
    });
  }
  return new Promise((resolve, reject) => {
    const { hostname, pathname } = new URL(url);
    const req = https.request(
      {
        hostname,
        path: pathname,
        method: "PUT",
        headers: {
          Authorization: basicAuth(),
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`CRM PUT ${res.statusCode}: ${Buffer.concat(chunks)}`));
          } else {
            resolve();
          }
        });
      },
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── Données des points de retrait CRM ────────────────────────────────────────

export type CrmPickupPoint = {
  ID: number;
  commercial_id: number;
  programmateur_vipbox: number;
};

export async function getCrmPickupPoints(): Promise<CrmPickupPoint[]> {
  if (!CRM_BASE || !CRM_USER || !CRM_PASS) return [];
  try {
    const data = await crmGet<{ records: CrmPickupPoint[] }>(
      "/records/point_retrait?include=ID,commercial_id,programmateur_vipbox&limit=300",
    );
    return data.records ?? [];
  } catch (err) {
    console.error("[CRM] getCrmPickupPoints failed:", err);
    return [];
  }
}

// ─── Capacités de réservation par modèle (admin) ──────────────────────────────
// Colonnes ajoutées sur point_retrait le 2026-07 pour remplacer la valeur fixe
// provisoire de lib/availability.ts (voir getModelCapacity()).

export const CAPACITY_FIELDS = [
  "reservation_maximum_classic",
  "reservation_maximum_smart",
  "reservation_maximum_360",
] as const;
export type CapacityField = (typeof CAPACITY_FIELDS)[number];

export type CrmPickupPointCapacity = {
  ID: number;
  reservation_maximum_classic: number | null;
  reservation_maximum_smart: number | null;
  reservation_maximum_360: number | null;
};

export async function getCrmPickupPointCapacities(): Promise<CrmPickupPointCapacity[]> {
  if (!CRM_BASE || !CRM_USER || !CRM_PASS) return [];
  try {
    const data = await crmGet<{ records: CrmPickupPointCapacity[] }>(
      "/records/point_retrait?include=ID," + CAPACITY_FIELDS.join(",") + "&limit=300",
      { fresh: true },
    );
    return data.records ?? [];
  } catch (err) {
    console.error("[CRM] getCrmPickupPointCapacities failed:", err);
    return [];
  }
}

export async function updateCrmPickupPointCapacity(
  crmId: number,
  field: CapacityField,
  value: number,
): Promise<void> {
  await crmPut(`/records/point_retrait/${crmId}`, { [field]: value });
}

// ─── Mapping options ──────────────────────────────────────────────────────────

const OPTION_TO_CRM_ID: Record<string, number> = {
  "classic-pack-full": 40,
  "classic-gif": 14,
  "classic-boomerang": 24,
  "classic-video": 18,
  "classic-boite-questions": 19,
  "classic-livre-or": 25,
  "classic-veille": 29,
  "classic-mise-en-page-1": 27,
  "classic-mise-en-page-2": 28,
  "classic-tirages-400": 36,
  "classic-tirages-800": 37,
  "classic-reimpression": 35,
  "smart-pack-full": 48,
  "smart-boomerang": 24,
  "smart-gif": 14,
  "smart-mise-en-page-1": 27,
  "smart-mise-en-page-2": 28,
  "smart-tirages-400": 36,
  "spinner-confort": 42,
};

function buildOptionsAnimations(selectedOptionIds: string[]): string | null {
  const ids = selectedOptionIds
    .map((id) => OPTION_TO_CRM_ID[id])
    .filter(Boolean) as number[];
  // Déduplique (ex: deux options mappées au même ID CRM)
  const unique = [...new Set(ids)];
  return unique.length > 0 ? unique.join(",") : null;
}

// Valeurs confirmées par inspection directe de vraies prestations existantes
// dans le CRM (2026-07-09, requête sur /records/prestations) : "Photobooth" et
// "Smart" apparaissent tels quels sur des milliers d'enregistrements réels
// (ex. commercial 669, montants cohérents avec nos tarifs), "360" de même pour
// le Spinner. Avant ce fix, Classic et Smart étaient tous deux écrits comme
// "Photobooth" (Smart ne remontait jamais distinctement dans le CRM).
function getTypeAnimationChoisie(modelSlug: string): string {
  switch (modelSlug) {
    case "smart":
      return "Smart";
    case "spinner-360":
      return "360";
    default:
      return "Photobooth"; // vipbox-classic
  }
}

function getNombreTirages(modelSlug: string, selectedOptionIds: string[]): string {
  if (modelSlug === "spinner-360") return "0";
  let total = 400;
  if (
    selectedOptionIds.includes("classic-tirages-400") ||
    selectedOptionIds.includes("smart-tirages-400")
  )
    total += 400;
  if (selectedOptionIds.includes("classic-tirages-800")) total += 800;
  return String(total);
}

// ─── Dates ────────────────────────────────────────────────────────────────────

// J−1 à 00:01 — jour de retrait à la PR
function dateRetrait(eventDate: string): string {
  const d = new Date(eventDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().substring(0, 10) + " 00:01:00";
}

// J+2 à 23:59 — jour de retour
function dateRetour(eventDate: string): string {
  const d = new Date(eventDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().substring(0, 10) + " 23:59:00";
}

// ─── Écriture CRM ─────────────────────────────────────────────────────────────

export type CrmReservationInput = {
  eventDate: string;         // YYYY-MM-DD
  crmPickupPointId: number;  // point_retrait.ID du CRM
  chefProjetId: number;      // equipe.id du chef de projet
  programmateurId: number;   // equipe.id du programmateur
  modelSlug: string;
  selectedOptionIds: string[];
  total: number;             // montant TTC en €
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  promoCode?: string | null;
  paymentMethod?: string;
};

export async function postToCrm(
  input: CrmReservationInput,
  table: "prestations" | "prestations_test" = "prestations",
): Promise<number> {
  const now = new Date()
    .toISOString()
    .replace("T", " ")
    .substring(0, 19);

  const payload: Record<string, unknown> = {
    bureau: "Sophia Antipolis",
    point_retrait: input.crmPickupPointId,
    date: input.eventDate + " 00:00:00",
    report: false,
    confirmation_covid: "en_cours",
    NatureDeLaPrestation: "MARIAGE",
    client_pr: false,
    client_wp: false,
    hierarchie: "unique",
    client: `${input.firstName} ${input.lastName}`,
    commercial: 595,
    chef_projet: input.chefProjetId,
    adresse: `${input.address}, ${input.postalCode} ${input.city}`,
    telephone: input.phone,
    mail1: input.email,
    communication:
      `Commande en ligne${input.promoCode ? ` - Code promo : ${input.promoCode}` : ""} - <br>`,
    dossier_livrer: "non",
    dossier_solder: "oui",
    annulation: false,
    presta_photo: "non",
    presta_video: "non",
    operateur_box: "63",
    planning_vipbox: "non_demande",
    montant_prestation_int: input.total,
    acomptes_percus: input.total.toFixed(2),
    acompte_non_necessaire: false,
    date_reservation: now,
    animations_photos_videos: "oui",
    type_animation_choisie: getTypeAnimationChoisie(input.modelSlug),
    MEP: "non_recue",
    programmateur_vip: input.programmateurId,
    statut_fond: "pas_de_fond",
    impressions_live_box: input.modelSlug === "spinner-360" ? null : "10/15",
    nombre_tirage_cc: getNombreTirages(input.modelSlug, input.selectedOptionIds),
    options_animations: buildOptionsAnimations(input.selectedOptionIds),
    mode_autonome: "autonome",
    date_retrait: dateRetrait(input.eventDate),
    date_retour: dateRetour(input.eventDate),
    statut_photo_box: "lien_envoyer",
    CRM: false,
    provenance_client: "1",
    avis_demander: "non",
    cel: 1,
    sinistre: false,
    nombre_photobooth: "1",
    nombre_photobooth_mini: "0",
    smugmug_folder_id: "0",
    presta_state: 1,
    fds: false,
    sav: false,
    no_mail_list: false,
    modalites_reglement: input.paymentMethod ?? "Carte bancaire",
  };

  if (input.promoCode) payload.code_promo = input.promoCode;

  return crmPost(`/records/${table}`, payload);
}
