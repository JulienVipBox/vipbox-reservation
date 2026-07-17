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

// ─── Capacités de réservation par modèle ───────────────────────────────────────
// Colonnes ajoutées sur point_retrait le 2026-07, éditables dans
// /admin/disponibilites et lues par lib/availability.ts (getModelCapacity())
// pour le blocage des dispos côté tunnel.

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

// Capacité d'une seule fiche — utilisée côté tunnel (blocage des dispos).
// Cache 1h comme le reste des lectures CRM/WP non critiques : une capacité
// changée par Julien met jusqu'à 1h à se répercuter pour un client réel, ce
// qui est acceptable pour cette donnée (contrairement à /admin/disponibilites,
// qui doit refléter une modif immédiatement, d'où `fresh: true` ci-dessus).
export async function getCrmPickupPointCapacity(
  crmId: number,
): Promise<CrmPickupPointCapacity | null> {
  if (!CRM_BASE || !CRM_USER || !CRM_PASS) return null;
  try {
    return await crmGet<CrmPickupPointCapacity>(
      `/records/point_retrait/${crmId}?include=ID,` + CAPACITY_FIELDS.join(","),
    );
  } catch (err) {
    console.error("[CRM] getCrmPickupPointCapacity failed:", err);
    return null;
  }
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

// De vraies prestations ont un date_retrait/date_retour vide en base, rempli
// par le CRM avec une date sentinelle "1999-01-01" plutôt qu'un vrai NULL —
// rencontré en prod le 2026-07-17 (2 prestations Lille fin août comptées à
// tort contre le 1er août, leur fenêtre sentinelle allant de 1999 à leur
// date_retour réelle, chevauchant n'importe quelle date demandée). Une
// date antérieure à 2020 est donc traitée comme "non renseignée".
function isPlausibleCrmDate(value: string | null): boolean {
  return !!value && parseInt(value.slice(0, 4), 10) >= 2020;
}

// `type_animation_choisie` peut contenir plusieurs animations combinées sur
// une seule prestation (ex. "360,Photobooth" pour un client ayant réservé
// les deux) — trouvé en audit le 2026-07-17 (12 prestations 2026+ dans ce
// cas). Un filtre d'égalité stricte les ignorait complètement, ce qui les
// excluait du décompte de TOUS les modèles (sous-comptage). On compare donc
// aux valeurs individuelles séparées par virgule, jamais en sous-chaîne —
// "Photobooth" ne doit pas matcher "Photobooth Mini", un tout autre produit.
function matchesModelType(rawType: string | null, target: string): boolean {
  if (!rawType) return false;
  return rawType.split(",").map((t) => t.trim()).includes(target);
}

// Nombre de prestations CRM déjà réservées pour ce PR + modèle, dont la
// fenêtre d'immobilisation de la machine (date_retrait → date_retour)
// chevauche celle qu'occuperait la nouvelle réservation demandée (même
// formule J-1/J+2 que postToCrm — voir dateRetrait()/dateRetour() ci-dessus).
// Si date_retrait/date_retour ne sont pas des dates plausibles sur une
// prestation existante, on retombe sur la même formule J-1/J+2 appliquée à
// son propre `date`, plutôt que de faire confiance à une valeur non fiable.
// `prestations` est LA source de vérité pour "déjà réservé" (confirmé par
// Julien, 2026-07-16) : elle couvre tous les canaux de vente (vipboxbooking.com,
// photoshaker.com, et le tunnel lui-même une fois postToCrm() câblé au
// paiement) — Supabase seul, utilisé avant ce fix, ignorait tout ce qui ne
// passe pas par ce tunnel.
// Exclut les prestations annulées (`annulation`) et reportées (`report` —
// un report libère la date d'origine, confirmé par Julien).
export async function getCrmBookingCount(
  crmId: number,
  modelSlug: string,
  eventDate: string,
): Promise<number> {
  if (!CRM_BASE || !CRM_USER || !CRM_PASS) return 0;
  try {
    // Pas de filtre type_animation_choisie côté requête CRM : ce champ peut
    // contenir plusieurs valeurs combinées (voir matchesModelType ci-dessus),
    // un filtre d'égalité côté serveur les raterait. Filtré en mémoire.
    // Filtre large sur `date` (fiable, toujours renseignée) plutôt que sur
    // date_retrait/date_retour (parfois absents ou sentinelles) — la marge
    // de 14 jours couvre largement les fenêtres réelles observées (quelques
    // jours autour de l'événement), le chevauchement précis se fait ensuite
    // en mémoire avec le fallback ci-dessus.
    const params = new URLSearchParams();
    params.append("include", "id,date,date_retrait,date_retour,type_animation_choisie");
    params.append("filter", `point_retrait,eq,${crmId}`);
    params.append("filter", "annulation,eq,false");
    params.append("filter", "report,eq,false");
    params.append("filter", `date,ge,${addDays(eventDate, -14)} 00:00:00`);
    params.append("filter", `date,le,${addDays(eventDate, 14)} 23:59:59`);

    const data = await crmGet<{
      records: {
        id: number;
        date: string;
        date_retrait: string | null;
        date_retour: string | null;
        type_animation_choisie: string | null;
      }[];
    }>(`/records/prestations?${params.toString()}`, { fresh: true }); // décompte critique, jamais mis en cache

    const targetType = getTypeAnimationChoisie(modelSlug);
    const candidateRetrait = dateRetrait(eventDate);
    const candidateRetour = dateRetour(eventDate);

    const overlapping = (data.records ?? []).filter((r) => {
      if (!matchesModelType(r.type_animation_choisie, targetType)) return false;

      const eventOnly = r.date.slice(0, 10);
      const retrait = isPlausibleCrmDate(r.date_retrait) ? r.date_retrait! : dateRetrait(eventOnly);
      const retour = isPlausibleCrmDate(r.date_retour) ? r.date_retour! : dateRetour(eventOnly);
      return retrait <= candidateRetour && retour >= candidateRetrait;
    });

    return overlapping.length;
  } catch (err) {
    console.error("[CRM] getCrmBookingCount failed:", err);
    return 0; // panne CRM → traité comme "aucune réservation" (fail open, jamais bloquer un client réel)
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
export function getTypeAnimationChoisie(modelSlug: string): string {
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
export function dateRetrait(eventDate: string): string {
  const d = new Date(eventDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().substring(0, 10) + " 00:01:00";
}

// J+2 à 23:59 — jour de retour
export function dateRetour(eventDate: string): string {
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
