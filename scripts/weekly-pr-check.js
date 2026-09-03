// Vérification hebdomadaire : compare les PR publiés sur vip-box.fr (WordPress)
// à la table `point_retrait` de la base CRM (serveurdms), et envoie un email
// systématique (OK ou écarts) via Brevo — jamais de silence.
//
// Contexte / méthodologie validée avec Julien le 2026-09-01 :
// - Lien WP <-> base : champ ACF `id_base` = point_retrait.ID côté CRM.
// - Champ fiable pour "ce PR doit être publié" : `liste_deroulante_formulaire_siteweb`
//   (libellé interface base : "Actif (site web)"). `enabled` et `statut` sont
//   trompeurs, ne pas les utiliser (voir CONTEXT.md / historique de la conversation).
// - Exceptions volontaires, à ne pas remonter comme anomalies :
//   id_base=143 (Brest, écart d'adresse connu, mis de côté), id_base=175
//   (Marmande, en attente de signature), id_base=83 (Troyes, changement en cours).
//
// Lancé par une tâche planifiée Windows (mardi 10h, heure locale — pas de souci
// de fuseau/DST contrairement à un cron UTC). Peut aussi être lancé à la main :
//   node scripts/weekly-pr-check.js

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ENV_PATH = path.join(__dirname, "..", ".env.local");
const REPORT_TO = "julien@vip-box.fr";
const IGNORED_ID_BASE = new Set([143, 175, 83]); // Brest / Marmande / Troyes — voir en-tête

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function getJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    https
      .get(
        {
          hostname,
          path: pathname + search,
          headers: { Accept: "application/json", ...(opts.headers || {}) },
          rejectUnauthorized: false, // même stratégie que lib/wordpress.ts et lib/crm.ts
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
            } catch (e) {
              reject(new Error(`Réponse non-JSON (HTTP ${res.statusCode}) depuis ${hostname}${pathname}`));
            }
          });
        },
      )
      .on("error", reject);
  });
}

async function fetchAllWpPickupPoints() {
  const all = [];
  let page = 1;
  while (true) {
    const { body } = await getJson(
      `https://www.vip-box.fr/wp-json/wp/v2/point_retrait?per_page=100&page=${page}&_fields=id,slug,title,adresse,code_postal,commune_reelle,id_base,status`,
    );
    if (!Array.isArray(body) || body.length === 0) break;
    all.push(...body);
    if (body.length < 100) break;
    page += 1;
  }
  return all.filter((w) => w.status === "publish");
}

async function fetchCrmPickupPoints(env) {
  const auth = "Basic " + Buffer.from(`${env.CRM_API_USER}:${env.CRM_API_PASSWORD}`).toString("base64");
  const { body } = await getJson(`${env.CRM_API_URL}/records/point_retrait?size=1000`, {
    headers: { Authorization: auth },
  });
  return body.records ?? [];
}

async function sendReportEmail(env, subject, textReport) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "VIPBOX - Vérif PR", email: "reservation@vip-box.fr" },
      to: [{ email: REPORT_TO }],
      subject,
      htmlContent: `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(textReport)}</pre>`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  const env = loadEnv();
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  let report;
  let hasIssues = false;

  try {
    const [wp, crm] = await Promise.all([fetchAllWpPickupPoints(), fetchCrmPickupPoints(env)]);

    const crmById = new Map(crm.map((r) => [r.ID, r]));
    const wpByIdBase = new Map();
    for (const w of wp) {
      const idBase = w.id_base ? Number(w.id_base) : null;
      if (!idBase) continue;
      if (!wpByIdBase.has(idBase)) wpByIdBase.set(idBase, []);
      wpByIdBase.get(idBase).push(w);
    }
    const actifBase = crm.filter((r) => r.liste_deroulante_formulaire_siteweb === true);

    const toCreate = actifBase.filter(
      (r) => !wpByIdBase.has(r.ID) && !IGNORED_ID_BASE.has(r.ID) && r.adresse,
    );
    const toClose = [...wpByIdBase.entries()].filter(([id]) => {
      if (IGNORED_ID_BASE.has(id)) return false;
      const r = crmById.get(id);
      return !r || r.liste_deroulante_formulaire_siteweb !== true;
    });
    const addressDrift = [];
    for (const [id, entries] of wpByIdBase) {
      if (IGNORED_ID_BASE.has(id)) continue;
      const r = crmById.get(id);
      if (!r) continue;
      for (const w of entries) {
        const wpCp = (w.code_postal || "").trim();
        const crmCp = (r.code_postal || "").trim();
        if (wpCp && crmCp && wpCp !== crmCp) {
          addressDrift.push({ id, slug: w.slug, wpCp, wpVille: w.commune_reelle, crmCp, crmVille: r.ville });
        }
      }
    }

    hasIssues = toCreate.length > 0 || toClose.length > 0 || addressDrift.length > 0;

    const lines = [];
    lines.push(hasIssues ? `⚠️ PR site vs base : ${toCreate.length + toClose.length + addressDrift.length} écart(s) détecté(s)` : "✅ PR site vs base : aucun écart");
    lines.push("");
    lines.push(`PR publiés côté WP : ${wp.length}`);
    lines.push(`PR "Actif (site web)" côté base : ${actifBase.length}`);
    lines.push("");

    if (toClose.length > 0) {
      lines.push("--- À dépublier / fermeture probable (publié sur le site, non actif en base) ---");
      for (const [id, entries] of toClose) {
        const r = crmById.get(id);
        for (const w of entries) {
          lines.push(`  id_base=${id} | ${w.slug} | ${w.title?.rendered ?? ""} | base: ${r ? r.point_de_retrait : "AUCUNE FICHE (lien cassé)"}`);
        }
      }
      lines.push("");
    }
    if (toCreate.length > 0) {
      lines.push("--- Actif en base, absent du site (à créer/vérifier) ---");
      for (const r of toCreate) {
        lines.push(`  id_base=${r.ID} | ${r.point_de_retrait} | ${r.ville ?? ""} ${r.code_postal ?? ""} | ${r.adresse ?? ""}`);
      }
      lines.push("");
    }
    if (addressDrift.length > 0) {
      lines.push("--- Écarts d'adresse (PR lié, code postal différent site vs base) ---");
      for (const d of addressDrift) {
        lines.push(`  id_base=${d.id} | ${d.slug} | WP: ${d.wpCp} ${d.wpVille} | Base: ${d.crmCp} ${d.crmVille}`);
      }
      lines.push("");
    }
    if (!hasIssues) {
      lines.push("Rien à signaler cette semaine, tout est aligné.");
    }
    lines.push("");
    lines.push(`Vérification effectuée le ${now}.`);
    report = lines.join("\n");
  } catch (err) {
    hasIssues = true;
    report = `❌ La vérification n'a pas pu être effectuée.\n\nErreur : ${err.message}\n\nVérification tentée le ${now}.`;
  }

  const subject = hasIssues ? "[VIPBOX] Vérif hebdo PR — écart(s) détecté(s)" : "[VIPBOX] Vérif hebdo PR — OK";
  console.log(report);
  await sendReportEmail(loadEnv(), subject, report);
  console.log("Email envoyé à", REPORT_TO);
}

main().catch((err) => {
  console.error("Échec du script (email non envoyé) :", err);
  process.exit(1);
});
