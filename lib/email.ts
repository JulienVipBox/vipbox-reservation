// SERVER-SIDE ONLY — envoi d'emails transactionnels via Brevo API v3
import type { MonEspaceResult } from "./monespace";
import { getSetting } from "./settings";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER = { name: "VIPBOX", email: "reservation@vip-box.fr" };
const DEFAULT_INTERNAL_EMAIL =
  process.env.INTERNAL_NOTIFICATION_EMAIL ?? "julien@vip-box.fr";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReservationEmailData = {
  // Réservation
  supabaseId: string;
  eventDate: string; // YYYY-MM-DD
  pickupPointName: string;
  pickupPointFullAddress: string | null;
  pickupPointHoraires: string | null;
  pickupPointPhone: string | null;
  modelName: string;
  modelPrice: number;
  options: string | null;
  promoCode: string | null;
  promoDiscount: number | null;
  totalAmount: number;
  // Client
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  // Mon-espace
  monEspace: MonEspaceResult;
  // CRM (peut être null si écriture différée)
  crmPrestationId?: number | null;
};

// ─── Envoi bas niveau ────────────────────────────────────────────────────────

async function sendEmail(payload: {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
}): Promise<void> {
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender: SENDER, ...payload }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
}

const DEFAULT_CLIENT_SUBJECT =
  "Votre réservation et vos identifiants VIPBOX — {date}";
const DEFAULT_CLIENT_INTRO =
  "Votre réservation VIPBOX est bien enregistrée. Voici le récapitulatif de votre commande, ainsi que vos identifiants. Ils vous permettront de préparer votre événement (personnalisation de vos tirages photos, etc.) sur votre espace client sécurisé.";

// ─── Email client (confirmation + accès mon-espace) ─────────────────────────

export async function sendClientConfirmationEmail(
  data: ReservationEmailData,
): Promise<void> {
  const [subjectTpl, intro] = await Promise.allSettled([
    getSetting("email_client_subject"),
    getSetting("email_client_intro"),
  ]);

  const date = formatDate(data.eventDate);
  const subject = (subjectTpl.status === "fulfilled" && subjectTpl.value
    ? subjectTpl.value
    : DEFAULT_CLIENT_SUBJECT
  )
    .replace("{date}", date)
    .replace("{prenom}", data.firstName)
    .replace("{nom}", data.lastName.toUpperCase());

  const introText =
    intro.status === "fulfilled" && intro.value
      ? intro.value
      : DEFAULT_CLIENT_INTRO;

  await sendEmail({
    to: [{ email: data.email, name: `${data.firstName} ${data.lastName}` }],
    subject,
    htmlContent: buildClientHtml(data, introText),
  });
}

// ─── Email interne (notification équipe) ────────────────────────────────────

export async function sendInternalNotificationEmail(
  data: ReservationEmailData,
): Promise<void> {
  // Lire les destinataires depuis les settings Supabase, fallback sur .env
  const recipientsSetting = await getSetting("email_internal_recipients").catch(() => null);
  const recipientList = (recipientsSetting ?? DEFAULT_INTERNAL_EMAIL)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const to = recipientList.map((email) => ({ email }));

  await sendEmail({
    to,
    subject: `[Commande] ${data.lastName.toUpperCase()} ${data.firstName} — ${formatDate(data.eventDate)} — ${data.modelName}`,
    htmlContent: buildInternalHtml(data),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const s = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // "vendredi 31 juillet 2026" → "Vendredi 31 juillet 2026"
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHoraires(raw: string | null): string {
  if (!raw) return "";
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).join("<br>");
}

// Extrait les noms des options offertes depuis la chaîne options stockée
// Format attendu : "Nom option (Offert), Autre option (30 €)"
function extractFreeOptionNames(optionsStr: string | null): string[] {
  if (!optionsStr) return [];
  return optionsStr
    .split(", ")
    .filter((s) => s.endsWith(" (Offert)"))
    .map((s) => s.slice(0, -" (Offert)".length));
}

// Ligne de détail du code promo pour les templates email
function promoDetailLine(
  discount: number | null,
  freeNames: string[],
): string {
  const parts: string[] = [];
  if (discount && discount > 0) parts.push(`−${discount} €`);
  if (freeNames.length > 0)
    parts.push(
      freeNames.map((n) => `${n} offert${freeNames.length > 1 ? "e" : ""}`).join(", "),
    );
  return parts.join(" · ");
}

// Rendu HTML des options (free en vert, payantes en noir)
function buildOptionsHtml(optionsStr: string | null): string {
  if (!optionsStr) return "";
  return optionsStr
    .split(", ")
    .map((item) => {
      const isFree = item.endsWith(" (Offert)");
      const label = isFree ? item.slice(0, -" (Offert)".length) : item;
      if (isFree) {
        return `<p style="margin:0 0 4px;font-size:14px;color:#16a34a;">${esc(label)}&nbsp;<span style="font-size:12px;">(Offert)</span></p>`;
      }
      return `<p style="margin:0 0 4px;font-size:14px;color:#374151;">${esc(item)}</p>`;
    })
    .join("");
}

// Ligne de détail promo en vert
function buildPromoDetailHtml(discount: number | null, freeNames: string[]): string {
  const detail = promoDetailLine(discount, freeNames);
  if (!detail) return "";
  return `<p style="margin:4px 0 0;font-size:13px;color:#16a34a;">${esc(detail)}</p>`;
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Template email client ───────────────────────────────────────────────────

function buildClientHtml(d: ReservationEmailData, introText = DEFAULT_CLIENT_INTRO): string {
  const { monEspace } = d;
  const loginUrl = monEspace.isNewUser
    ? `https://mon-espace.vip-box.fr/login#pw=${monEspace.password}&un=${encodeURIComponent(d.email)}`
    : `https://mon-espace.vip-box.fr/login#un=${encodeURIComponent(d.email)}`;

  const horairesHtml = formatHoraires(d.pickupPointHoraires);
  const hasOptions = !!d.options;
  const hasPromo = !!d.promoCode;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background:#03071E;padding:20px;text-align:center;">
        <img src="https://www.vip-box.fr/wp-content/uploads/2026/04/Logo_VIPBOX_ORx300clair.png"
             alt="VIPBOX" height="52" style="height:52px;display:block;margin:0 auto;">
      </td>
    </tr>
  </table>

  <!-- Corps -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" align="center"
               style="max-width:600px;width:100%;margin:0 auto;">

          <!-- Accroche -->
          <tr>
            <td style="background:#ffffff;padding:40px 32px 24px;border-radius:12px 12px 0 0;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:bold;color:#AF8D4A;
                        text-transform:uppercase;letter-spacing:0.5px;">
                Réservation confirmée ✓
              </p>
              <h1 style="margin:0 0 16px;font-size:22px;color:#03071E;">
                Merci ${esc(d.firstName)}&nbsp;!
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#555;">
                ${esc(introText)}
              </p>
            </td>
          </tr>

          <!-- Récapitulatif -->
          <tr>
            <td style="background:#ffffff;padding:0 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">

                <!-- Date -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:bold;color:#9ca3af;
                              text-transform:uppercase;letter-spacing:1px;">Date</p>
                    <p style="margin:0;font-size:15px;font-weight:bold;color:#03071E;">
                      ${esc(formatDate(d.eventDate))}
                    </p>
                  </td>
                </tr>

                <!-- Lieu -->
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0 0 5px;font-size:10px;font-weight:bold;color:#9ca3af;
                              text-transform:uppercase;letter-spacing:1px;">Lieu de retrait</p>
                    <p style="margin:0 0 2px;font-size:15px;font-weight:bold;color:#03071E;">
                      ${esc(d.pickupPointName)}
                    </p>
                    ${d.pickupPointFullAddress ? `<p style="margin:0 0 2px;font-size:13px;color:#555;">${esc(d.pickupPointFullAddress)}</p>` : ""}
                    ${d.pickupPointPhone ? `<p style="margin:0 0 6px;font-size:13px;color:#555;">${esc(d.pickupPointPhone)}</p>` : ""}
                    ${horairesHtml ? `<p style="margin:0;font-size:12px;color:#777;line-height:1.5;">${horairesHtml}</p>` : ""}
                  </td>
                </tr>

                <!-- Modèle -->
                <tr>
                  <td style="padding:16px 20px;${hasOptions || hasPromo ? "border-bottom:1px solid #e5e7eb;" : ""}">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:bold;color:#9ca3af;
                              text-transform:uppercase;letter-spacing:1px;">Modèle</p>
                    <p style="margin:0;font-size:15px;font-weight:bold;color:#03071E;">
                      ${esc(d.modelName)}
                    </p>
                  </td>
                </tr>

                <!-- Options -->
                ${hasOptions ? `
                <tr>
                  <td style="padding:16px 20px;${hasPromo ? "border-bottom:1px solid #e5e7eb;" : ""}">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:bold;color:#9ca3af;
                              text-transform:uppercase;letter-spacing:1px;">Options</p>
                    ${buildOptionsHtml(d.options)}
                  </td>
                </tr>
                ` : ""}

                <!-- Code promo -->
                ${hasPromo ? `
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#9ca3af;
                              text-transform:uppercase;letter-spacing:1px;">Code promo</p>
                    <p style="margin:0;font-size:14px;font-weight:bold;color:#03071E;">
                      ${esc(d.promoCode)}
                    </p>
                    ${buildPromoDetailHtml(d.promoDiscount, extractFreeOptionNames(d.options))}
                  </td>
                </tr>
                ` : ""}

                <!-- Total -->
                <tr>
                  <td style="padding:16px 20px;background:#f9fafb;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:14px;color:#555;">Total payé</td>
                        <td style="font-size:20px;font-weight:bold;color:#03071E;text-align:right;">
                          ${d.totalAmount}&nbsp;€
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Mon espace -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:bold;color:#9ca3af;
                        text-transform:uppercase;letter-spacing:1px;">Votre espace client</p>
              <h2 style="margin:0 0 12px;font-size:17px;color:#03071E;">
                Accédez à mon-espace.vip-box.fr
              </h2>

              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding-right:12px;font-size:13px;color:#888;white-space:nowrap;">
                    Identifiant :
                  </td>
                  <td style="font-size:14px;font-weight:bold;color:#03071E;">${esc(d.email)}</td>
                </tr>
                ${monEspace.isNewUser ? `
                <tr>
                  <td style="padding-top:8px;padding-right:12px;font-size:13px;color:#888;white-space:nowrap;">
                    Mot de passe :
                  </td>
                  <td style="padding-top:8px;font-size:14px;font-weight:bold;color:#03071E;letter-spacing:2px;">
                    ${esc(monEspace.password!)}
                  </td>
                </tr>
                ` : `
                <tr>
                  <td style="padding-top:8px;padding-right:12px;font-size:13px;color:#888;white-space:nowrap;">
                    Mot de passe :
                  </td>
                  <td style="padding-top:8px;font-size:13px;color:#555;">
                    Votre mot de passe habituel
                  </td>
                </tr>
                `}
              </table>

              <a href="${loginUrl}"
                 style="display:inline-block;background:#AF8D4A;color:#ffffff;
                        text-decoration:none;padding:12px 24px;border-radius:8px;
                        font-size:14px;font-weight:bold;">
                Se connecter à mon espace →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#03071E;padding:24px 32px;text-align:center;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 4px;color:#AF8D4A;font-weight:bold;font-size:14px;">VIPBOX</p>
              <p style="margin:0 0 2px;font-size:12px;">
                <a href="https://www.vip-box.fr" style="color:#6b7280;text-decoration:none;">www.vip-box.fr</a>
              </p>
              <p style="margin:0;color:#6b7280;font-size:12px;">
                110 agences de location en France &bull; 09.52.45.52.17
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Template email interne ──────────────────────────────────────────────────

function buildInternalHtml(d: ReservationEmailData): string {
  const row = (label: string, value: string | number | null | undefined) =>
    value
      ? `<tr>
           <td style="padding:8px 12px;font-size:13px;color:#6b7280;width:180px;white-space:nowrap;">
             ${esc(label)}
           </td>
           <td style="padding:8px 12px;font-size:13px;color:#111827;font-weight:500;">
             ${esc(String(value))}
           </td>
         </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">

  <table width="600" cellpadding="0" cellspacing="0" border="0" align="center"
         style="max-width:600px;width:100%;margin:0 auto;">

    <tr>
      <td style="background:#03071E;padding:16px 24px;border-radius:8px 8px 0 0;">
        <p style="margin:0;font-size:12px;font-weight:bold;color:#AF8D4A;
                  text-transform:uppercase;letter-spacing:0.5px;">
          Nouvelle commande VIPBOX
        </p>
      </td>
    </tr>

    <tr>
      <td style="background:#ffffff;padding:24px;">

        <h2 style="margin:0 0 20px;font-size:17px;color:#111827;">
          ${esc(d.lastName.toUpperCase())} ${esc(d.firstName)}
          &nbsp;&mdash;&nbsp;${esc(formatDate(d.eventDate))}
        </h2>

        <!-- Réservation -->
        <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#9ca3af;
                  text-transform:uppercase;letter-spacing:1px;">Réservation</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
          ${row("Date", formatDate(d.eventDate))}
          ${row("Lieu de retrait", d.pickupPointName)}
          ${row("Modèle", d.modelName)}
          ${row("Options", d.options)}
          ${d.promoCode ? `
          <tr>
            <td style="padding:8px 12px;font-size:13px;color:#6b7280;width:180px;white-space:nowrap;vertical-align:top;">
              Code promo
            </td>
            <td style="padding:8px 12px;">
              <p style="margin:0;font-size:13px;color:#111827;font-weight:500;">${esc(d.promoCode)}</p>
              ${promoDetailLine(d.promoDiscount, extractFreeOptionNames(d.options)) ? `<p style="margin:3px 0 0;font-size:12px;color:#16a34a;">${esc(promoDetailLine(d.promoDiscount, extractFreeOptionNames(d.options)))}</p>` : ""}
            </td>
          </tr>
          ` : ""}
          ${row("Total", `${d.totalAmount} €`)}
        </table>

        <!-- Client -->
        <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#9ca3af;
                  text-transform:uppercase;letter-spacing:1px;">Client</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
          ${row("Nom", `${d.lastName.toUpperCase()} ${d.firstName}`)}
          ${row("E-mail", d.email)}
          ${row("Téléphone", d.phone)}
          ${row("Adresse", `${d.address}, ${d.postalCode} ${d.city}`)}
        </table>

        <!-- Mon-espace -->
        <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#9ca3af;
                  text-transform:uppercase;letter-spacing:1px;">Mon-espace</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
          ${row("Compte", d.monEspace.isNewUser ? "Nouveau compte créé" : "Compte existant lié")}
          ${row("ID vipbox_users", d.monEspace.userId)}
          ${d.monEspace.isNewUser && d.monEspace.password ? row("Mot de passe généré", d.monEspace.password) : ""}
        </table>

        <!-- Références -->
        <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#9ca3af;
                  text-transform:uppercase;letter-spacing:1px;">Références</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border:1px solid #e5e7eb;border-radius:6px;">
          ${row("ID CRM", d.crmPrestationId)}
          ${row("ID Supabase", d.supabaseId)}
        </table>

      </td>
    </tr>

    <tr>
      <td style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb;
                 border-radius:0 0 8px 8px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          VIPBOX — Réservation en ligne
        </p>
      </td>
    </tr>

  </table>
</body>
</html>`;
}
