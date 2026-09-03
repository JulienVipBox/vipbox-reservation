// Séries mensuelles CRM (demandes entrantes canal site + réservations en
// ligne `cel`) sur la même fenêtre que le pull GSC (16 derniers mois
// calendaires) — voir ANALYTICS-CRM.md pour le détail des champs/pièges.
//
// Usage : node scripts/crm-monthly.js
//   -> imprime un tableau mensuel : demandes (canal formulaire du site,
//      Mariage+Pro+Particulier), réservations en ligne (cel=1, non annulées)
//      + montant.

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const ENV_PATH = path.join(__dirname, "..", ".env.local");

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function getJson(url, auth) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    https
      .get(
        {
          hostname,
          path: pathname + search,
          headers: { Authorization: `Basic ${Buffer.from(auth).toString("base64")}`, Accept: "application/json" },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch (e) {
              reject(new Error(`Réponse non-JSON (HTTP ${res.statusCode}) pour ${url}`));
            }
          });
        },
      )
      .on("error", reject);
  });
}

function monthRange(year, month) {
  // month = 1-12
  const start = `${year}-${String(month).padStart(2, "0")}-01 00:00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")} 23:59:59`;
  return { start, end };
}

async function countProspect(env, auth, start, end) {
  const url =
    `${env.CRM_API_URL}/records/Prospect` +
    `?filter=Date_1er_contact,ge,${encodeURIComponent(start)}` +
    `&filter=Date_1er_contact,le,${encodeURIComponent(end)}` +
    `&filter=Provenance,in,formulaires de contact,Site VIP BOX - demande entrante` +
    `&filter=nature_prestation,in,MARIAGE,PRO,PARTICULIER` +
    `&include=ID&page=1,1`;
  const body = await getJson(url, auth);
  return body.results ?? 0;
}

async function sumCel(env, auth, start, end) {
  const url =
    `${env.CRM_API_URL}/records/prestations` +
    `?filter=date_reservation,ge,${encodeURIComponent(start)}` +
    `&filter=date_reservation,le,${encodeURIComponent(end)}` +
    `&filter=cel,eq,1` +
    `&filter=annulation,eq,0` +
    `&include=ID,montant_prestation_int&page=1,5000`;
  const body = await getJson(url, auth);
  const records = body.records || [];
  const montant = records.reduce((s, r) => s + (Number(r.montant_prestation_int) || 0), 0);
  return { count: body.results ?? records.length, montant };
}

async function main() {
  const env = loadEnv();
  const auth = `${env.CRM_API_USER}:${env.CRM_API_PASSWORD}`;

  // Même fenêtre que le pull GSC : 16 mois calendaires, 2025-05 -> 2026-08.
  const months = [];
  let y = 2025, m = 5;
  for (let i = 0; i < 16; i++) {
    months.push([y, m]);
    m++;
    if (m > 12) { m = 1; y++; }
  }

  console.log("Mois     | Demandes (canal site) | Réservations en ligne | Montant réservations en ligne");
  console.log("---------|------------------------|------------------------|-------------------------------");

  const rows = [];
  for (const [year, month] of months) {
    const { start, end } = monthRange(year, month);
    const [demandes, cel] = await Promise.all([
      countProspect(env, auth, start, end),
      sumCel(env, auth, start, end),
    ]);
    const label = `${year}-${String(month).padStart(2, "0")}`;
    rows.push({ month: label, demandes, cel: cel.count, montant: cel.montant });
    console.log(
      `${label}  | ${String(demandes).padStart(22)} | ${String(cel.count).padStart(22)} | ${String(Math.round(cel.montant)).padStart(29)}`,
    );
  }

  fs.writeFileSync(path.join(__dirname, "crm-monthly-output.json"), JSON.stringify(rows, null, 2));
  console.log("\n(Copie JSON écrite dans scripts/crm-monthly-output.json)");
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exitCode = 1;
});
