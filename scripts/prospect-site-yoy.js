// Demandes entrantes, canal formulaire du site uniquement (le canal utilise
// pour la comparaison refonte), mois calendaire par mois calendaire, sur
// plusieurs annees -> permet de calculer un taux de variation YoY par mois
// (mai N vs mai N-1, juin N vs juin N-1, etc.) et de voir si le taux de
// baisse 2026 vs 2025 sort ou non de la tendance etablie par les
// transitions d'annees precedentes, plutot que de comparer une seule paire
// pre/post-refonte. Demande de Julien (3 sept. 2026).
//
// Usage : node scripts/prospect-site-yoy.js

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
            try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(new Error(`Réponse non-JSON pour ${url}`)); }
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

async function countSite(env, auth, start, end) {
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

async function main() {
  const env = loadEnv();
  const auth = `${env.CRM_API_USER}:${env.CRM_API_PASSWORD}`;

  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const byYear = {};
  for (const year of years) {
    byYear[year] = {};
    const lastMonth = year === 2026 ? 8 : 12;
    for (let month = 1; month <= lastMonth; month++) {
      const { start, end } = monthRange(year, month);
      byYear[year][month] = await countSite(env, auth, start, end);
      process.stderr.write(`${year}-${String(month).padStart(2, "0")} : ${byYear[year][month]}\n`);
    }
  }

  fs.writeFileSync(path.join(__dirname, "prospect-site-yoy-raw.json"), JSON.stringify(byYear, null, 2));

  const names = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  console.log("\n=== YoY (%) par mois calendaire, canal site uniquement ===\n");
  console.log("Mois  | " + years.slice(1).map((y) => `${y - 1}→${y}`.padStart(9)).join(" "));
  for (let m = 1; m <= 12; m++) {
    const cells = [];
    for (let i = 1; i < years.length; i++) {
      const y = years[i], yPrev = years[i - 1];
      const cur = byYear[y][m], prev = byYear[yPrev][m];
      if (cur === undefined || prev === undefined || !prev) { cells.push("".padStart(9)); continue; }
      const pct = ((cur - prev) / prev) * 100;
      cells.push((pct >= 0 ? "+" : "") + pct.toFixed(0) + "%".padStart(0));
    }
    console.log(`${names[m - 1]}  | ` + cells.map((c) => c.padStart(9)).join(" "));
  }
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exitCode = 1;
});
