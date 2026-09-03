// Saisonnalité des demandes entrantes (table CRM Prospect), sur ~7-8 ans.
// But : isoler la forme saisonnière (quel mois pèse plus/moins qu'un autre
// dans l'année) de la tendance de fond (volume total en déclin depuis
// l'exercice 2022) — indispensable avant d'interpréter un avant/après
// refonte qui compare des mois calendaires différents (ex. avril vs juillet).
//
// Table Prospect uniquement (pas prestations : date_reservation est décalée
// de plusieurs semaines/mois par rapport à la demande réelle — voir
// ANALYTICS-CRM.md). Toutes provenances confondues (échantillon plus robuste
// que le seul canal site pour capter la vraie forme saisonnière).
//
// Usage : node scripts/prospect-seasonality.js

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
        { hostname, path: pathname + search, headers: { Authorization: `Basic ${Buffer.from(auth).toString("base64")}`, Accept: "application/json" } },
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
    `&filter=nature_prestation,in,MARIAGE,PRO,PARTICULIER` +
    `&include=ID&page=1,1`;
  const body = await getJson(url, auth);
  return body.results ?? 0;
}

async function main() {
  const env = loadEnv();
  const auth = `${env.CRM_API_USER}:${env.CRM_API_PASSWORD}`;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Années calendaires complètes disponibles depuis le point de départ (1er
  // nov. 2018) : 2019 -> année en cours - 1. + année en cours en partiel.
  const fullYears = [];
  for (let y = 2019; y < currentYear; y++) fullYears.push(y);

  const byYear = {}; // { year: { month: count } }
  for (const year of [...fullYears, currentYear]) {
    byYear[year] = {};
    const lastMonth = year === currentYear ? currentMonth - 1 : 12; // mois dernier plein
    for (let month = 1; month <= lastMonth; month++) {
      const { start, end } = monthRange(year, month);
      byYear[year][month] = await countProspect(env, auth, start, end);
      process.stderr.write(`${year}-${String(month).padStart(2, "0")} : ${byYear[year][month]}\n`);
    }
  }

  fs.writeFileSync(path.join(__dirname, "prospect-seasonality-raw.json"), JSON.stringify(byYear, null, 2));

  // Indice saisonnier : pour chaque année complète, part de chaque mois dans
  // le total de l'année (%), puis moyenne de cette part sur les années
  // complètes uniquement (années partielles exclues du calcul de l'indice,
  // affichées à part pour comparaison).
  console.log("\n=== Part de chaque mois dans le total de son année (%) ===\n");
  console.log("Année  | " + Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(5)).join(" "));
  const shareByMonth = Array.from({ length: 12 }, () => []);
  for (const year of fullYears) {
    const counts = byYear[year];
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    const shares = [];
    for (let m = 1; m <= 12; m++) {
      const share = total ? (counts[m] / total) * 100 : 0;
      shares.push(share);
      shareByMonth[m - 1].push(share);
    }
    console.log(`${year}   | ` + shares.map((s) => s.toFixed(1).padStart(5)).join(" "));
  }

  console.log("\n=== Indice saisonnier moyen (7 années complètes, base 100 = moyenne mensuelle) ===\n");
  const avgShare = shareByMonth.map((arr) => arr.reduce((s, v) => s + v, 0) / arr.length);
  const meanOfAvg = avgShare.reduce((s, v) => s + v, 0) / 12; // ~8.33% si parfaitement plat
  const index = avgShare.map((s) => (s / meanOfAvg) * 100);
  const monthNames = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  for (let m = 0; m < 12; m++) {
    console.log(`${monthNames[m]} : indice ${index[m].toFixed(0)} (part moyenne ${avgShare[m].toFixed(1)}%)`);
  }

  fs.writeFileSync(
    path.join(__dirname, "prospect-seasonality-index.json"),
    JSON.stringify({ monthNames, index, avgShare, fullYears, byYear }, null, 2),
  );
  console.log("\n(Détail écrit dans scripts/prospect-seasonality-index.json et -raw.json)");
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exitCode = 1;
});
