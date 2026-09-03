// Série mensuelle GSC nettoyée (spam jeux d'argent du 13 juin 2026 + bruit
// d'homonyme de marque "vipbox" = site pirate de streaming sportif), mois
// calendaire par mois calendaire — pour voir une progression fine plutôt
// qu'un seul bloc pré/post refonte. Méthode : soustraction précise des
// lignes date×query correspondantes (jamais excludingRegex en aveugle, voir
// ANALYTICS-CRM.md pour le piège rencontré).
//
// Usage : node scripts/gsc-monthly-clean.js 2025-11 2026-08
//   (mois de début et de fin, calendaires, inclus)

const { loadEnv, getAccessToken, searchAnalyticsQuery } = require("./gsc-query.js");

const SPAM = "situs|slot|togel|mpo[0-9]|prima[0-9]|delman|judi|casino|toto[0-9]|gacor|maxwin|rtp[0-9]|bandar|pkv|domino[0-9]|sbobet";
const BRAND = "vip ?box|vio ?box|bipbox|cipbox|vipvox|vip ox|vipbo$|vipbo\\.|vipbox\\.";

function monthBounds(label) {
  const [y, m] = label.split("-").map(Number);
  const start = `${label}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${label}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function nextMonth(label) {
  const [y, m] = label.split("-").map(Number);
  const d = new Date(y, m, 1); // m est déjà 1-based -> avance d'un mois
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sumRows(rows) {
  let clicks = 0, impressions = 0, posW = 0;
  for (const r of rows) { clicks += r.clicks; impressions += r.impressions; posW += r.position * r.impressions; }
  return { clicks, impressions, posW };
}

async function matchingRows(token, start, end, regex) {
  return searchAnalyticsQuery(token, {
    startDate: start, endDate: end, dimensions: ["date", "query"],
    dimensionFilterGroups: [{ filters: [{ dimension: "query", operator: "includingRegex", expression: regex }] }],
    rowLimit: 25000,
  });
}

async function cleanMonth(token, label) {
  const { start, end } = monthBounds(label);
  const raw = await searchAnalyticsQuery(token, { startDate: start, endDate: end, dimensions: ["date"], rowLimit: 25000 });
  const rawT = sumRows(raw);
  const spamT = sumRows(await matchingRows(token, start, end, SPAM));
  const brandT = sumRows(await matchingRows(token, start, end, BRAND));
  const clicks = rawT.clicks - spamT.clicks - brandT.clicks;
  const impressions = rawT.impressions - spamT.impressions - brandT.impressions;
  const posW = rawT.posW - spamT.posW - brandT.posW;
  return {
    label,
    brutClicks: rawT.clicks, brutImpressions: rawT.impressions,
    clicks, impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? posW / impressions : 0,
  };
}

async function main() {
  const [fromArg, toArg] = process.argv.slice(2);
  if (!fromArg || !toArg) throw new Error("Usage : node scripts/gsc-monthly-clean.js 2025-11 2026-08");

  const env = loadEnv();
  const token = await getAccessToken(env);

  const months = [];
  for (let m = fromArg; m <= toArg; m = nextMonth(m)) months.push(m);

  console.log("Mois     | Brut clics | Brut impr. | NET clics | NET impr. | NET CTR | NET position");
  console.log("---------|------------|------------|-----------|-----------|---------|-------------");
  for (const m of months) {
    const r = await cleanMonth(token, m);
    console.log(
      `${r.label}  | ${String(r.brutClicks).padStart(10)} | ${String(r.brutImpressions).padStart(10)} | ` +
      `${String(r.clicks).padStart(9)} | ${String(r.impressions).padStart(9)} | ` +
      `${(r.ctr * 100).toFixed(2).padStart(6)}% | ${r.position.toFixed(1).padStart(12)}`,
    );
  }
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exitCode = 1;
});
