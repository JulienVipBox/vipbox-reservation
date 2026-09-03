// Autorisation OAuth "Application de bureau" pour Google Search Console —
// à lancer une seule fois (node scripts/gsc-auth.js). Affiche un lien à
// ouvrir et sur lequel se connecter/autoriser ; une fois fait, écrit
// GSC_REFRESH_TOKEN dans .env.local et vérifie l'accès en listant les
// propriétés Search Console visibles avec ce compte. Voir scripts/gsc-query.js
// pour l'usage ensuite (aucune interaction requise après cette étape).
//
// Contexte : le compte de service classique est bloqué par une règle
// d'organisation Google Workspace (iam.managed.disableServiceAccountKeyCreation),
// d'où ce détour par un client OAuth "Application de bureau" (projet Cloud
// "vipbox-tools", créé le 2026-09-01).

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");

const ENV_PATH = path.join(__dirname, "..", ".env.local");
const PORT = 8976;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const { hostname, pathname } = new URL(url);
    const req = https.request(
      {
        hostname,
        path: pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
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
    req.write(body);
    req.end();
  });
}

function getJson(url, accessToken) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    https
      .get(
        {
          hostname,
          path: pathname + search,
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
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
      )
      .on("error", reject);
  });
}

function waitForAuthCode(server) {
  return new Promise((resolve, reject) => {
    server.on("request", (req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (!code && !error) {
        // Requêtes parasites du navigateur (favicon.ico, etc.) — ignorer en silence.
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        error
          ? `<p>Autorisation refusée (${error}). Tu peux fermer cette fenêtre.</p>`
          : `<p>C'est bon, tu peux fermer cette fenêtre et retourner sur Claude Code.</p>`,
      );
      if (error) reject(new Error(error));
      else resolve(code);
    });
  });
}

function updateEnvRefreshToken(refreshToken) {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  const updated = raw.includes("GSC_REFRESH_TOKEN=")
    ? raw.replace(/^#?\s*GSC_REFRESH_TOKEN=.*$/m, `GSC_REFRESH_TOKEN=${refreshToken}`)
    : raw + `\nGSC_REFRESH_TOKEN=${refreshToken}\n`;
  fs.writeFileSync(ENV_PATH, updated);
}

async function main() {
  const env = loadEnv();
  if (!env.GSC_CLIENT_ID || !env.GSC_CLIENT_SECRET) {
    throw new Error("GSC_CLIENT_ID / GSC_CLIENT_SECRET manquants dans .env.local");
  }

  const server = http.createServer().listen(PORT);
  const authCodePromise = waitForAuthCode(server);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", env.GSC_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  console.log("\n=== LIEN A OUVRIR ===");
  console.log(authUrl.toString());
  console.log("=====================\n");
  console.log("En attente du clic sur \"Autoriser\"...\n");

  const code = await authCodePromise;
  server.close();

  const { status, body: tokens } = await postForm("https://oauth2.googleapis.com/token", {
    code,
    client_id: env.GSC_CLIENT_ID,
    client_secret: env.GSC_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  if (status !== 200 || !tokens.refresh_token) {
    throw new Error(`Échec de l'échange du code : HTTP ${status} — ${JSON.stringify(tokens)}`);
  }

  updateEnvRefreshToken(tokens.refresh_token);
  console.log("GSC_REFRESH_TOKEN enregistré dans .env.local.\n");

  // Vérification : liste des propriétés Search Console accessibles avec ce compte
  const { body: sites } = await getJson("https://www.googleapis.com/webmasters/v3/sites", tokens.access_token);
  console.log("Propriétés Search Console accessibles avec ce compte :");
  for (const s of sites.siteEntry || []) console.log(` - ${s.siteUrl} (${s.permissionLevel})`);
  console.log("\nTERMINE.");
}

main().catch((e) => {
  console.error("Erreur :", e.message);
  process.exitCode = 1;
});
