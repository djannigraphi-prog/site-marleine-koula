/* Vérification des jetons de connexion Firebase (signature RS256 de Google).
   Référence : https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library */

const JWKS_GOOGLE = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MARGE_SECONDES = 60;

let cache = { cles: null, expire: 0, url: "" };

function b64urlVersOctets(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlVersJson(s) { return JSON.parse(new TextDecoder().decode(b64urlVersOctets(s))); }

async function clesPubliques(url, fetchFn, maintenant) {
  if (cache.cles && cache.url === url && cache.expire > maintenant) return cache.cles;
  const r = await fetchFn(url);
  if (!r.ok) throw new Error("Clés publiques indisponibles (" + r.status + ")");
  const { keys } = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get("Cache-Control") || "");
  cache = { cles: keys, expire: maintenant + (m ? Math.min(Number(m[1]), 21600) : 3600), url };
  return keys;
}

export function _viderCache() { cache = { cles: null, expire: 0, url: "" }; }

/**
 * Vérifie un jeton d'identité Firebase. Lève une erreur si quoi que ce soit ne va pas.
 * @returns {Promise<{email: string, uid: string, fournisseur: string, emailVerifie: boolean}>}
 */
export async function verifierJetonFirebase(jeton, env, fetchFn = (...a) => fetch(...a), maintenant = Math.floor(Date.now() / 1000)) {
  const projet = env.FIREBASE_PROJECT_ID;
  if (!projet) throw new Error("FIREBASE_PROJECT_ID manquant");
  const parties = String(jeton).split(".");
  if (parties.length !== 3) throw new Error("Format de jeton invalide");
  const [h64, p64, s64] = parties;
  const entete = b64urlVersJson(h64);
  if (entete.alg !== "RS256" || !entete.kid) throw new Error("Algorithme non accepté");

  const cles = await clesPubliques(env.JWKS_URL || JWKS_GOOGLE, fetchFn, maintenant);
  const jwk = cles.find((k) => k.kid === entete.kid);
  if (!jwk) throw new Error("Clé de signature inconnue");
  const cle = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valide = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cle, b64urlVersOctets(s64), new TextEncoder().encode(h64 + "." + p64));
  if (!valide) throw new Error("Signature invalide");

  const c = b64urlVersJson(p64);
  if (c.aud !== projet) throw new Error("Audience invalide");
  if (c.iss !== "https://securetoken.google.com/" + projet) throw new Error("Émetteur invalide");
  if (typeof c.exp !== "number" || c.exp < maintenant - MARGE_SECONDES) throw new Error("Jeton expiré");
  if (typeof c.iat !== "number" || c.iat > maintenant + MARGE_SECONDES) throw new Error("Date d'émission invalide");
  if (typeof c.auth_time !== "number" || c.auth_time > maintenant + MARGE_SECONDES) throw new Error("Date de connexion invalide");
  if (!c.sub || typeof c.sub !== "string") throw new Error("Utilisateur manquant");
  if (!c.firebase || typeof c.firebase.sign_in_provider !== "string") throw new Error("Méthode de connexion inconnue");
  if (!c.email) throw new Error("E-mail manquant");
  return { email: String(c.email).toLowerCase(), uid: c.sub, fournisseur: c.firebase.sign_in_provider, emailVerifie: c.email_verified === true };
}
