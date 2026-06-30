// Helpers d'authentification admin — compatible Edge Runtime et Node.js
// Cookie : base64url(payload).HMAC-SHA256(payload)

const COOKIE_NAME = "vipbox_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function str2ab(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer;
}

function ab2b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(str: string): string {
  return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}

function b64urlToArrayBuffer(str: string): ArrayBuffer {
  const binary = b64urlDecode(str);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_SECRET ?? "changeme";
  return crypto.subtle.importKey(
    "raw",
    str2ab(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export { COOKIE_NAME };

export async function createSessionCookie(): Promise<string> {
  const payloadStr = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const payload = ab2b64url(str2ab(payloadStr));
  const key = await hmacKey();
  const sig = ab2b64url(await crypto.subtle.sign("HMAC", key, str2ab(payload)));
  return `${payload}.${sig}`;
}

export async function verifySessionCookie(cookie: string): Promise<boolean> {
  const dot = cookie.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = cookie.substring(0, dot);
  const sig = cookie.substring(dot + 1);

  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToArrayBuffer(sig),
      str2ab(payload),
    );
    if (!valid) return false;

    const payloadJson = JSON.parse(b64urlDecode(payload));
    return typeof payloadJson.exp === "number" && payloadJson.exp > Date.now();
  } catch {
    return false;
  }
}
