// SERVER-SIDE ONLY — gestion des comptes mon-espace.vip-box.fr (table vipbox_users)
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const CRM_API_URL = process.env.CRM_API_URL!;
const CRM_API_USER = process.env.CRM_API_USER!;
const CRM_API_PASSWORD = process.env.CRM_API_PASSWORD!;

function crmHeaders() {
  const b64 = Buffer.from(`${CRM_API_USER}:${CRM_API_PASSWORD}`).toString("base64");
  return {
    Authorization: `Basic ${b64}`,
    "Content-Type": "application/json",
  };
}

export type MonEspaceResult = {
  userId: number;
  isNewUser: boolean;
  password?: string; // mot de passe en clair — uniquement pour les nouveaux comptes
};

export async function findOrCreateMonEspaceAccount(
  email: string,
): Promise<MonEspaceResult> {
  const emailLc = email.toLowerCase();

  // 1. Chercher si le compte existe déjà
  const lookupRes = await fetch(
    `${CRM_API_URL}/records/vipbox_users?filter=email_canonical,eq,${encodeURIComponent(emailLc)}&columns=id,email`,
    { headers: crmHeaders() },
  );

  if (!lookupRes.ok) {
    throw new Error(`CRM vipbox_users lookup failed: ${lookupRes.status}`);
  }

  const lookup = await lookupRes.json();

  if (lookup.records && lookup.records.length > 0) {
    return { userId: lookup.records[0].id, isNewUser: false };
  }

  // 2. Créer un nouveau compte
  const password = randomBytes(3).toString("hex"); // ex: "c1d0b8"
  const passwordHash = await bcrypt.hash(password, 10);

  const createRes = await fetch(`${CRM_API_URL}/records/vipbox_users`, {
    method: "POST",
    headers: crmHeaders(),
    body: JSON.stringify({
      username: email,
      username_canonical: emailLc,
      email: email,
      email_canonical: emailLc,
      enabled: true,
      salt: "",
      password: passwordHash,
      roles: "a:0:{}",
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`CRM vipbox_users creation failed: ${createRes.status} — ${errText}`);
  }

  // php-crud-api retourne l'ID directement (entier)
  const userId = await createRes.json();

  return { userId, isNewUser: true, password };
}
