// Requêtes Google Search Console (Search Analytics) — réutilisable, aucune
// interaction requise (utilise GSC_REFRESH_TOKEN, voir scripts/gsc-auth.js
// pour l'obtenir la première fois).
//
// Usage direct : node scripts/gsc-query.js
//   -> imprime clics/impressions/CTR/position moyenne par mois, tout le site,
//      sur les 16 derniers mois (limite de rétention GSC).
//
// Pensé pour être aussi importé ailleurs (module.exports) une fois qu'on
// voudra affiner par page/requête/PR plutôt que juste la vue globale.

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ENV_PATH = path.join(__dirname, "..", ".env.local");
const SITE_URL = "sc-domain:vip-box.fr";

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const { hostname, pathname, search } = new URL(url);
    const req = https.request(
      {
        hostname,
        path: pathname + search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
          } catch (e) {
            reject(new Error(`Réponse non-JSON (HTTP ${res.statusCode})`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function getAccessToken(env) {
  if (!env.GSC_REFRESH_TOKEN) throw new Error("GSC_REFRESH_TOKEN manquant dans .env.local — lancer scripts/gsc-auth.js");
  const body = new URLSearchParams({
    client_id: env.GSC_CLIENT_ID,
    client_secret: env.GSC_CLIENT_SECRET,
    refresh_token: env.GSC_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }).toString();
  const { hostname, pathname } = new URL("https://oauth2.googleapis.com/token");
  const { status, body: tokens } = await new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path: pathname, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
  if (status !== 200 || !tokens.access_token) throw new Error(`Échec du refresh token : HTTP ${status} — ${JSON.stringify(tokens)}`);
  return tokens.access_token;
}

async function searchAnalyticsQuery(accessToken, queryBody) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;
  const { status, body } = await postJson(url, queryBody, { Authorization: `Bearer ${accessToken}` });
  if (status !== 200) throw new Error(`Échec requête Search Analytics : HTTP ${status} — ${JSON.stringify(body)}`);
  return body.rows || [];
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const env = loadEnv();
  const accessToken = await getAccessToken(env);

  const end = new Date();
  end.setDate(end.getDate() - 3); // GSC a ~2-3 jours de décalage, éviter les données incomplètes
  const start = new Date(end);
  start.setMonth(start.getMonth() - 16); // limite de rétention GSC

  const rows = await searchAnalyticsQuery(accessToken, {
    startDate: isoDate(start),
    endDate: isoDate(end),
    dimensions: ["date"],
    rowLimit: 25000,
  });

  // Agrégation par mois calendaire (convention du projet, voir ANALYTICS-CRM.md)
  const byMonth = {};
  for (const r of rows) {
    const month = r.keys[0].slice(0, 7); // YYYY-MM
    byMonth[month] ??= { clicks: 0, impressions: 0, posWeighted: 0 };
    byMonth[month].clicks += r.clicks;
    byMonth[month].impressions += r.impressions;
    byMonth[month].posWeighted += r.position * r.impressions;
  }

  console.log(`Propriété : ${SITE_URL}  (${isoDate(start)} -> ${isoDate(end)})\n`);
  console.log("Mois     | Clics | Impressions | CTR    | Position moy.");
  console.log("---------|-------|-------------|--------|---------------");
  for (const month of Object.keys(byMonth).sort()) {
    const m = byMonth[month];
    const ctr = m.impressions ? ((m.clicks / m.impressions) * 100).toFixed(2) + "%" : "-";
    const pos = m.impressions ? (m.posWeighted / m.impressions).toFixed(1) : "-";
    console.log(`${month}  | ${String(m.clicks).padStart(5)} | ${String(m.impressions).padStart(11)} | ${ctr.padStart(6)} | ${pos.padStart(13)}`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("Erreur :", e.message);
    process.exitCode = 1;
  });
}

module.exports = { loadEnv, getAccessToken, searchAnalyticsQuery, SITE_URL };
