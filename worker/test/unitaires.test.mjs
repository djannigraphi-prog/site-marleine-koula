/* Tests du serveur d'administration (node --test). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerGestionnaire, validerFichier, validerPhotoBase64 } from "../src/core.js";
import { verifierJetonFirebase, _viderCache } from "../src/jeton-firebase.js";

const PROJET = "mk-test";
const b64url = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

async function cles() {
  const paire = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("jwk", paire.publicKey);
  return { paire, jwk: { ...pub, kid: "cle1", alg: "RS256", use: "sig" } };
}
async function signer(paire, revendications, entete = { alg: "RS256", kid: "cle1", typ: "JWT" }) {
  const donnees = b64url(entete) + "." + b64url(revendications);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", paire.privateKey, new TextEncoder().encode(donnees));
  return donnees + "." + Buffer.from(sig).toString("base64url");
}
const maintenant = Math.floor(Date.now() / 1000);
const revendicationsOk = (plus = {}) => ({ iss: "https://securetoken.google.com/" + PROJET, aud: PROJET, auth_time: maintenant - 10, iat: maintenant - 10, exp: maintenant + 3500, sub: "uid1", email: "MarleineKoula@gmail.com", email_verified: true, firebase: { sign_in_provider: "google.com" }, ...plus });

const { paire, jwk } = await cles();
const autre = await cles();
const fetchJwks = async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { "Cache-Control": "max-age=600" } });
const env = { FIREBASE_PROJECT_ID: PROJET, JWKS_URL: "https://test/jwks" };

test("jeton valide accepté (e-mail mis en minuscules)", async () => {
  _viderCache();
  const r = await verifierJetonFirebase(await signer(paire, revendicationsOk()), env, fetchJwks, maintenant);
  assert.equal(r.email, "marleinekoula@gmail.com");
});

for (const [nom, rev, entete, attendu] of [
  ["expiré", { exp: maintenant - 3600 }, null, /expiré/],
  ["mauvais projet (aud)", { aud: "autre" }, null, /Audience/],
  ["mauvais émetteur", { iss: "https://securetoken.google.com/autre" }, null, /Émetteur/],
  ["méthode de connexion absente", { firebase: {} }, null, /Méthode/],
  ["algorithme none", {}, { alg: "none", kid: "cle1" }, /Algorithme/],
  ["clé inconnue", {}, { alg: "RS256", kid: "inconnue" }, /inconnue/],
]) {
  test("jeton refusé : " + nom, async () => {
    _viderCache();
    const j = await signer(paire, revendicationsOk(rev), entete || undefined);
    await assert.rejects(() => verifierJetonFirebase(j, env, fetchJwks, maintenant), attendu);
  });
}

test("jeton refusé : signé par une autre clé", async () => {
  _viderCache();
  const j = await signer(autre.paire, revendicationsOk());
  await assert.rejects(() => verifierJetonFirebase(j, env, fetchJwks, maintenant), /Signature/);
});

test("jeton refusé : contenu modifié après signature", async () => {
  _viderCache();
  const j = await signer(paire, revendicationsOk());
  const [h, , s] = j.split(".");
  const falsifie = h + "." + b64url(revendicationsOk({ email: "pirate@example.com" })) + "." + s;
  await assert.rejects(() => verifierJetonFirebase(falsifie, env, fetchJwks, maintenant), /Signature/);
});

/* ---------- Gestionnaire HTTP ---------- */

const envServeur = { ...env, ADMIN_EMAILS: "marleinekoula@gmail.com", ALLOWED_ORIGINS: "https://marleinekoula.com", GITHUB_REPO: "x/y", GITHUB_TOKEN: "t" };
const gerer = creerGestionnaire({ verifierJeton: (j, e) => verifierJetonFirebase(j, e, fetchJwks), fetch: async () => { throw new Error("GitHub ne doit pas être appelé"); } });
const req = (chemin, init = {}) => new Request("https://admin.test" + chemin, { ...init, headers: { Origin: "https://marleinekoula.com", ...(init.headers || {}) } });

test("sans connexion : 401", async () => {
  const r = await gerer(req("/api/contenu"), envServeur);
  assert.equal(r.status, 401);
});

test("compte non autorisé : 403", async () => {
  _viderCache();
  const j = await signer(paire, revendicationsOk({ email: "intrus@gmail.com" }));
  const r = await gerer(req("/api/session", { headers: { Authorization: "Bearer " + j } }), envServeur);
  assert.equal(r.status, 403);
  assert.match((await r.json()).erreur, /pas autorisé/);
});

test("compte autorisé : session OK", async () => {
  _viderCache();
  const j = await signer(paire, revendicationsOk());
  const r = await gerer(req("/api/session", { headers: { Authorization: "Bearer " + j } }), envServeur);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).email, "marleinekoula@gmail.com");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://marleinekoula.com");
});

test("compte autorisé mais connexion par mot de passe (non activée) : 403", async () => {
  _viderCache();
  const j = await signer(paire, revendicationsOk({ firebase: { sign_in_provider: "password" } }));
  const r = await gerer(req("/api/session", { headers: { Authorization: "Bearer " + j } }), envServeur);
  assert.equal(r.status, 403);
});

test("compte Google dont l'e-mail n'est pas vérifié : 403", async () => {
  _viderCache();
  const j = await signer(paire, revendicationsOk({ email_verified: false }));
  const r = await gerer(req("/api/session", { headers: { Authorization: "Bearer " + j } }), envServeur);
  assert.equal(r.status, 403);
});

test("connexion anonyme Firebase refusée", async () => {
  _viderCache();
  const j = await signer(paire, revendicationsOk({ firebase: { sign_in_provider: "anonymous" } }));
  const r = await gerer(req("/api/session", { headers: { Authorization: "Bearer " + j } }), envServeur);
  assert.equal(r.status, 403);
});

test("même origine (page d'essai servie par le serveur) : acceptée", async () => {
  _viderCache();
  const j = await signer(paire, revendicationsOk());
  const r = await gerer(new Request("https://admin.test/api/session", { headers: { Origin: "https://admin.test", Authorization: "Bearer " + j } }), envServeur);
  assert.equal(r.status, 200);
});

test("réglages publics /api/config : pas de secret exposé", async () => {
  const r = await gerer(req("/api/config"), { ...envServeur, GITHUB_TOKEN: "secret-github-xyz", FIREBASE_API_KEY: "cle-publique" });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(d.firebase, { apiKey: "cle-publique", authDomain: PROJET + ".firebaseapp.com", projectId: PROJET });
  assert.ok(!JSON.stringify(d).includes("secret-github-xyz"));
  assert.ok(!JSON.stringify(d).includes("marleinekoula@gmail.com"));
});

test("site étranger (autre origine) : 403 et aucun en-tête CORS", async () => {
  const r = await gerer(new Request("https://admin.test/api/session", { headers: { Origin: "https://pirate.example" } }), envServeur);
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
});

/* ---------- Validation ---------- */

test("validation : produits corrects", () => {
  assert.ok(validerFichier("produits", { produits: [{ nom: "A", prix: 1000, prix_promo: null, image: "images/uploads/a.jpg" }] }));
});
test("validation : prix négatif ou texte refusé", () => {
  assert.throws(() => validerFichier("produits", { produits: [{ nom: "A", prix: -5 }] }), /Prix invalide/);
  assert.throws(() => validerFichier("produits", { produits: [{ nom: "A", prix: "mille" }] }), /Prix invalide/);
});
test("validation : nom vide refusé", () => {
  assert.throws(() => validerFichier("categories", { categories: [{ nom: "  " }] }), /nom est obligatoire/);
});
test("validation : image externe ou script refusés", () => {
  assert.throws(() => validerFichier("produits", { produits: [{ nom: "A", image: "javascript:alert(1)" }] }), /photo invalide/);
  assert.throws(() => validerFichier("produits", { produits: [{ nom: "A", image: "https://pirate.example/x.jpg" }] }), /photo invalide/);
});
test("validation : fichier inconnu refusé", () => {
  assert.throws(() => validerFichier("../../.github/workflows/x", {}), /Fichier inconnu/);
});

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]).toString("base64");
test("photo : JPG et PNG valides", () => {
  assert.ok(validerPhotoBase64(jpeg, "jpg") > 200);
  assert.ok(validerPhotoBase64(png, "png") > 200);
});
test("photo : faux JPG (autre contenu) refusé", () => {
  assert.throws(() => validerPhotoBase64(png, "jpg"), /pas une vraie photo/);
  assert.throws(() => validerPhotoBase64(Buffer.alloc(300, 65).toString("base64"), "jpg"), /pas une vraie photo/);
});
test("photo : format non autorisé refusé", () => {
  assert.throws(() => validerPhotoBase64(jpeg, "gif"), /Format de photo non autorisé/);
  assert.throws(() => validerPhotoBase64(jpeg, "svg"), /Format de photo non autorisé/);
});
test("photo : plus de 5 Mo refusée", () => {
  const gros = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(6 * 1024 * 1024)]).toString("base64");
  assert.throws(() => validerPhotoBase64(gros, "jpg"), /trop lourde/);
});
