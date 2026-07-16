/**
 * Vérification serveur d'un token Cloudflare Turnstile (widget affiché dans
 * CoordonneesForm.tsx). Tant que TURNSTILE_SECRET_KEY n'est pas défini dans
 * .env.local, la vérification est un no-op (renvoie true) — le formulaire
 * continue de fonctionner normalement en attendant la config.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}
