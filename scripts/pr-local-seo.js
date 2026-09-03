// Croisement SEO local : pour un echantillon de PR a fort volume, met en
// regard GSC (clics/impressions/position sur la page du PR) et CRM
// (demandes canal site + reservations en ligne cel=1, via date_reservation
// — pas la date de l'evenement) sur les fenetres pre/post-refonte.
// Demande de Julien (3 sept. 2026) : le SEO local est un enjeu majeur,
// voir si un effet local est visible PR par PR.
//
// Usage : node scripts/pr-local-seo.js

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { loadEnv, getAccessToken, searchAnalyticsQuery } = require("./gsc-query.js");

const ENV_PATH = path.join(__dirname, "..", ".env.local");

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

const PRE = { start: "2026-02-12", end: "2026-05-19" };
const POST = { start: "2026-05-20", end: "2026-08-24" };

async function countProspect(auth, crmUrl, pr, start, end) {
  const url =
    `${crmUrl}/records/Prospect` +
    `?filter=Date_1er_contact,ge,${encodeURIComponent(start + " 00:00:00")}` +
    `&filter=Date_1er_contact,le,${encodeURIComponent(end + " 23:59:59")}` +
    `&filter=Provenance,in,formulaires de contact,Site VIP BOX - demande entrante` +
    `&filter=nature_prestation,in,MARIAGE,PRO,PARTICULIER` +
    `&filter=point_retrait,eq,${pr}` +
    `&include=ID&page=1,1`;
  const body = await getJson(url, auth);
  return body.results ?? 0;
}

async function countCel(auth, crmUrl, pr, start, end) {
  const url =
    `${crmUrl}/records/prestations` +
    `?filter=date_reservation,ge,${encodeURIComponent(start + " 00:00:00")}` +
    `&filter=date_reservation,le,${encodeURIComponent(end + " 23:59:59")}` +
    `&filter=cel,eq,1&filter=annulation,eq,0` +
    `&filter=point_retrait,eq,${pr}` +
    `&include=ID&page=1,1`;
  const body = await getJson(url, auth);
  return body.results ?? 0;
}

async function gscForPage(token, slug, start, end) {
  const rows = await searchAnalyticsQuery(token, {
    startDate: start, endDate: end,
    dimensions: [],
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `location-photobooth-${slug}` }] }],
    rowLimit: 1,
  });
  return rows[0] || { clicks: 0, impressions: 0, position: 0 };
}

async function main() {
  const env = loadEnv();
  const auth = `${env.CRM_API_USER}:${env.CRM_API_PASSWORD}`;
  const token = await getAccessToken(env);

  const prList = JSON.parse(fs.readFileSync(path.join(__dirname, "pr-top.json"), "utf8"));
  // prList : [{ pr: "15", slug: "paris", title: "..." }, ...]

  console.log("PR (slug) | Demandes pré→post | Résa. pré→post | GSC clics pré→post | GSC impr. pré→post | GSC pos. pré→post");
  console.log("-".repeat(120));

  const results = [];
  for (const { pr, slug, title } of prList) {
    const [dPre, dPost, cPre, cPost, gPre, gPost] = await Promise.all([
      countProspect(auth, env.CRM_API_URL, pr, PRE.start, PRE.end),
      countProspect(auth, env.CRM_API_URL, pr, POST.start, POST.end),
      countCel(auth, env.CRM_API_URL, pr, PRE.start, PRE.end),
      countCel(auth, env.CRM_API_URL, pr, POST.start, POST.end),
      gscForPage(token, slug, PRE.start, PRE.end),
      gscForPage(token, slug, POST.start, POST.end),
    ]);
    const row = { pr, slug, title, dPre, dPost, cPre, cPost, gPre, gPost };
    results.push(row);
    console.log(
      `${title} (${slug}) | ${dPre}→${dPost} | ${cPre}→${cPost} | ${gPre.clicks}→${gPost.clicks} | ${gPre.impressions}→${gPost.impressions} | ${gPre.position.toFixed(1)}→${gPost.position.toFixed(1)}`,
    );
  }

  fs.writeFileSync(path.join(__dirname, "pr-local-seo-output.json"), JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exitCode = 1;
});
