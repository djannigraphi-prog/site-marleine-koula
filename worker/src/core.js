/* Serveur d'administration Marleine Koula — logique principale.
   Rôle : vérifier que la personne connectée est autorisée, puis lire et publier
   le contenu du site (dossier data/ et photos images/uploads/) dans le dépôt GitHub.
   La clé GitHub reste ici, côté serveur : elle n'apparaît jamais dans le site public. */

export const FICHIERS = {
  produits: "data/produits.json",
  categories: "data/categories.json",
  prestations: "data/prestations.json",
  site: "data/site.json",
};

const CLE_RACINE = { produits: "produits", categories: "categories", prestations: "prestations" };
const DOSSIER_PHOTOS = "images/uploads";
const RE_CHEMIN_PHOTO = /^images\/uploads\/[a-z0-9][a-z0-9-]{0,80}\.(jpg|png|webp)$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const PHOTO_MAX_OCTETS = 5 * 1024 * 1024; // après compression dans le navigateur
const JSON_MAX_OCTETS = 400 * 1024;
const TEXTE_MAX = 10000;

const SIGNATURES = {
  jpg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // « RIFF » … « WEBP » vérifié plus bas
};

export class ErreurHttp extends Error {
  constructor(statut, message, code) { super(message); this.statut = statut; this.code = code || "erreur"; }
}

/* ---------- Réponses et CORS ---------- */

function originesAutorisees(env) {
  return String(env.ALLOWED_ORIGINS || "https://marleinekoula.com").split(",").map((s) => s.trim()).filter(Boolean);
}

function origineAutorisee(req, env) {
  const origine = req.headers.get("Origin");
  if (!origine) return true;
  return origine === new URL(req.url).origin || originesAutorisees(env).includes(origine);
}

function entetesCors(req, env) {
  const origine = req.headers.get("Origin");
  const h = { "Vary": "Origin" };
  if (origine && origineAutorisee(req, env)) {
    h["Access-Control-Allow-Origin"] = origine;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

function json(req, env, statut, donnees) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...entetesCors(req, env) },
  });
}

/* ---------- Accès GitHub ---------- */

function github(env, fetchFn) {
  const api = env.GITHUB_API || "https://api.github.com";
  const depot = env.GITHUB_REPO;
  if (!depot || !env.GITHUB_TOKEN) throw new ErreurHttp(500, "Le serveur n'est pas encore configuré (dépôt ou clé GitHub manquant).", "configuration");
  return async function appel(methode, chemin, corps, brut) {
    const r = await fetchFn(api + "/repos/" + depot + chemin, {
      method: methode,
      headers: {
        "Authorization": "Bearer " + env.GITHUB_TOKEN,
        "Accept": brut ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "marleinekoula-admin",
        ...(corps !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: corps === undefined ? undefined : (typeof corps === "string" ? corps : JSON.stringify(corps)),
    });
    if (!r.ok) {
      const texte = await r.text().catch(() => "");
      const e = new ErreurHttp(r.status === 404 ? 404 : 502, "GitHub a répondu " + r.status + " (" + methode + " " + chemin + ")", "github");
      e.githubStatut = r.status; e.details = texte.slice(0, 300);
      throw e;
    }
    if (brut) return r.text();
    return r.status === 204 ? null : r.json();
  };
}

/* ---------- Validation du contenu ---------- */

function verifierValeurs(v, chemin, profondeur) {
  if (profondeur > 8) throw new ErreurHttp(400, "Contenu trop imbriqué (" + chemin + ").", "validation");
  if (v === null || typeof v === "boolean") return;
  if (typeof v === "number") { if (!Number.isFinite(v)) throw new ErreurHttp(400, "Nombre invalide (" + chemin + ").", "validation"); return; }
  if (typeof v === "string") { if (v.length > TEXTE_MAX) throw new ErreurHttp(400, "Texte trop long (" + chemin + ").", "validation"); return; }
  if (Array.isArray(v)) { if (v.length > 2000) throw new ErreurHttp(400, "Liste trop longue (" + chemin + ").", "validation"); v.forEach((x, i) => verifierValeurs(x, chemin + "[" + i + "]", profondeur + 1)); return; }
  if (typeof v === "object") { for (const k of Object.keys(v)) { if (!/^[a-z_][a-z0-9_]{0,40}$/.test(k)) throw new ErreurHttp(400, "Nom de champ invalide (" + chemin + "." + k + ").", "validation"); verifierValeurs(v[k], chemin + "." + k, profondeur + 1); } return; }
  throw new ErreurHttp(400, "Valeur invalide (" + chemin + ").", "validation");
}

function verifierImage(valeur, chemin) {
  if (valeur === "" || valeur === null || valeur === undefined) return;
  if (typeof valeur !== "string" || !/^(images\/uploads|assets\/logo|images)\/[A-Za-z0-9._-]+$/.test(valeur)) {
    throw new ErreurHttp(400, "Chemin de photo invalide (" + chemin + ").", "validation");
  }
}

function prixValide(p, chemin) {
  if (p === null || p === "" || p === undefined) return;
  if (typeof p !== "number" || !Number.isInteger(p) || p < 0 || p > 100000000) throw new ErreurHttp(400, "Prix invalide (" + chemin + ") : un nombre entier positif est attendu.", "validation");
}

export function validerFichier(nom, contenu) {
  if (!(nom in FICHIERS)) throw new ErreurHttp(400, "Fichier inconnu : " + nom, "validation");
  if (!contenu || typeof contenu !== "object" || Array.isArray(contenu)) throw new ErreurHttp(400, "Contenu invalide pour " + nom + ".", "validation");
  verifierValeurs(contenu, nom, 0);
  if (nom === "site") {
    for (const k of ["identite", "accueil", "boutique", "a_propos", "contact", "coordonnees", "commande"]) {
      if (!contenu[k] || typeof contenu[k] !== "object") throw new ErreurHttp(400, "Section manquante dans les textes du site : " + k, "validation");
    }
    if (!Array.isArray(contenu.reseaux)) throw new ErreurHttp(400, "La liste des réseaux sociaux est manquante.", "validation");
    for (const [section, champ] of [["identite", "logo"], ["identite", "logo_rond"], ["accueil", "enseigne_image"], ["accueil", "proprietaire_photo"], ["a_propos", "image"]]) {
      verifierImage(contenu[section][champ], section + "." + champ);
    }
  } else {
    const liste = contenu[CLE_RACINE[nom]];
    if (!Array.isArray(liste)) throw new ErreurHttp(400, "La liste « " + CLE_RACINE[nom] + " » est manquante.", "validation");
    liste.forEach((el, i) => {
      const ch = nom + "[" + i + "]";
      if (!el || typeof el !== "object" || Array.isArray(el)) throw new ErreurHttp(400, "Élément invalide (" + ch + ").", "validation");
      if (typeof el.nom !== "string" || !el.nom.trim()) throw new ErreurHttp(400, "Le nom est obligatoire (" + ch + ").", "validation");
      if ("prix" in el) prixValide(el.prix, ch + ".prix");
      if ("prix_promo" in el) prixValide(el.prix_promo, ch + ".prix_promo");
      if ("image" in el) verifierImage(el.image, ch + ".image");
    });
  }
  const texte = JSON.stringify(contenu, null, 2) + "\n";
  if (texte.length > JSON_MAX_OCTETS) throw new ErreurHttp(400, "Le fichier " + nom + " est trop volumineux.", "validation");
  return texte;
}

function decoderDebutBase64(b64, n) {
  const debut = atob(b64.slice(0, Math.ceil((n * 4) / 3 / 4) * 4 + 4));
  return Array.from(debut.slice(0, n), (c) => c.charCodeAt(0));
}

export function validerPhotoBase64(b64, ext) {
  if (!SIGNATURES[ext]) throw new ErreurHttp(400, "Format de photo non autorisé. Formats acceptés : JPG, PNG, WebP.", "format");
  if (!b64 || b64.length < 64) throw new ErreurHttp(400, "La photo est vide ou incomplète.", "format");
  const octets = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (octets > PHOTO_MAX_OCTETS) throw new ErreurHttp(413, "La photo est trop lourde (5 Mo maximum après compression).", "taille");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new ErreurHttp(400, "La photo n'a pas pu être lue (données invalides).", "format");
  const debut = decoderDebutBase64(b64, 12);
  const ok = SIGNATURES[ext].some((sig) => sig.every((o, i) => debut[i] === o)) &&
    (ext !== "webp" || String.fromCharCode(...debut.slice(8, 12)) === "WEBP");
  if (!ok) throw new ErreurHttp(400, "Le fichier envoyé n'est pas une vraie photo " + ext.toUpperCase() + ".", "format");
  return octets;
}

function nomPhoto(indice, ext) {
  const propre = String(indice || "photo").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const alea = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
  return DOSSIER_PHOTOS + "/" + date + "-" + propre + "-" + alea + "." + ext;
}

/* ---------- Gestionnaire HTTP ---------- */

/**
 * @param {object} deps
 * @param {(jeton: string, env: object) => Promise<{email: string}>} deps.verifierJeton
 * @param {typeof fetch} [deps.fetch]
 */
export function creerGestionnaire(deps) {
  const fetchFn = deps.fetch || ((...a) => fetch(...a));

  async function authentifier(req, env) {
    const m = (req.headers.get("Authorization") || "").match(/^Bearer ([A-Za-z0-9._-]+)$/);
    if (!m) throw new ErreurHttp(401, "Veuillez vous connecter.", "non_connecte");
    let identite;
    try { identite = await deps.verifierJeton(m[1], env); }
    catch (e) { throw new ErreurHttp(401, "Votre session a expiré. Veuillez vous reconnecter.", "jeton_invalide"); }
    const fournisseurs = String(env.ALLOWED_PROVIDERS || "google.com").split(",").map((s) => s.trim()).filter(Boolean);
    if (!fournisseurs.includes(identite.fournisseur)) throw new ErreurHttp(403, "Cette méthode de connexion n'est pas acceptée.", "methode");
    if (identite.fournisseur !== "password" && !identite.emailVerifie) throw new ErreurHttp(403, "L'adresse e-mail de ce compte n'est pas vérifiée.", "non_autorise");
    const email = String(identite.email || "").toLowerCase();
    const autorises = String(env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    if (!email || !autorises.includes(email)) throw new ErreurHttp(403, "Ce compte n'est pas autorisé à administrer le site.", "non_autorise");
    return { email };
  }

  async function lireContenu(env) {
    const gh = github(env, fetchFn);
    const branche = env.GITHUB_BRANCH || "main";
    const ref = await gh("GET", "/git/ref/heads/" + encodeURIComponent(branche));
    const base = ref.object.sha;
    const noms = Object.keys(FICHIERS);
    const textes = await Promise.all(noms.map((n) => gh("GET", "/contents/" + FICHIERS[n] + "?ref=" + base, undefined, true)));
    const fichiers = {};
    noms.forEach((n, i) => { fichiers[n] = JSON.parse(textes[i]); });
    return { base, fichiers };
  }

  async function envoyerPhoto(req, env, url) {
    const ext = String(url.searchParams.get("ext") || "").toLowerCase().replace("jpeg", "jpg");
    const longueur = Number(req.headers.get("Content-Length") || 0);
    if (longueur > PHOTO_MAX_OCTETS * 1.4 + 1024) throw new ErreurHttp(413, "La photo est trop lourde (5 Mo maximum après compression).", "taille");
    const b64 = (await req.text()).trim();
    const octets = validerPhotoBase64(b64, ext);
    const gh = github(env, fetchFn);
    const blob = await gh("POST", "/git/blobs", '{"encoding":"base64","content":"' + b64 + '"}');
    return { chemin: nomPhoto(url.searchParams.get("nom"), ext), sha: blob.sha, octets };
  }

  async function publier(req, env, utilisateur) {
    let corps;
    try { corps = await req.json(); } catch (e) { throw new ErreurHttp(400, "Requête illisible.", "validation"); }
    const { base, fichiers = {}, photos = [], supprimer = [] } = corps || {};
    if (!RE_SHA.test(String(base || ""))) throw new ErreurHttp(400, "Version de départ manquante. Rechargez la page.", "validation");
    if (!Array.isArray(photos) || !Array.isArray(supprimer) || typeof fichiers !== "object") throw new ErreurHttp(400, "Requête invalide.", "validation");

    const entrees = [];
    for (const nom of Object.keys(fichiers)) entrees.push({ path: FICHIERS[nom] || "?", mode: "100644", type: "blob", content: validerFichier(nom, fichiers[nom]) });
    const cheminsPhotos = new Set();
    for (const p of photos) {
      if (!p || !RE_CHEMIN_PHOTO.test(String(p.chemin)) || !RE_SHA.test(String(p.sha))) throw new ErreurHttp(400, "Photo invalide dans la publication.", "validation");
      cheminsPhotos.add(p.chemin);
      entrees.push({ path: p.chemin, mode: "100644", type: "blob", sha: p.sha });
    }
    for (const c of supprimer) {
      if (!RE_CHEMIN_PHOTO.test(String(c))) throw new ErreurHttp(400, "Suppression de photo invalide.", "validation");
    }
    if (!entrees.length && !supprimer.length) throw new ErreurHttp(400, "Aucune modification à publier.", "vide");

    const gh = github(env, fetchFn);
    const branche = env.GITHUB_BRANCH || "main";
    const ref = await gh("GET", "/git/ref/heads/" + encodeURIComponent(branche));
    const tete = ref.object.sha;

    if (tete !== base) {
      // Le site a changé depuis le chargement : on refuse seulement si les mêmes fichiers ont été modifiés.
      const comparaison = await gh("GET", "/compare/" + base + "..." + tete);
      const touches = new Set((comparaison.files || []).map((f) => f.filename));
      const conflit = Object.keys(fichiers).some((n) => touches.has(FICHIERS[n]));
      if (conflit) throw new ErreurHttp(409, "Le site a été modifié ailleurs entre-temps. Rechargez l'administration pour récupérer la dernière version, puis refaites vos changements.", "conflit");
    }

    if (supprimer.length) {
      let existants = [];
      try { existants = (await gh("GET", "/contents/" + DOSSIER_PHOTOS + "?ref=" + tete)).map((f) => f.path); } catch (e) { if (e.githubStatut !== 404) throw e; }
      for (const c of new Set(supprimer)) {
        if (existants.includes(c) && !cheminsPhotos.has(c)) entrees.push({ path: c, mode: "100644", type: "blob", sha: null });
      }
    }
    if (!entrees.length) throw new ErreurHttp(400, "Aucune modification à publier.", "vide");

    const commitTete = await gh("GET", "/git/commits/" + tete);
    const arbre = await gh("POST", "/git/trees", { base_tree: commitTete.tree.sha, tree: entrees });
    const resume = String(corps.message || "Mise à jour du contenu").replace(/[\r\n]+/g, " ").slice(0, 120);
    const commit = await gh("POST", "/git/commits", {
      message: resume + " (administration, " + utilisateur.email + ")",
      tree: arbre.sha,
      parents: [tete],
      author: { name: "Administration Marleine Koula", email: "admin@marleinekoula.com" },
    });
    try {
      await gh("PATCH", "/git/refs/heads/" + encodeURIComponent(branche), { sha: commit.sha, force: false });
    } catch (e) {
      if (e.githubStatut === 422) throw new ErreurHttp(409, "Une autre publication vient d'avoir lieu. Réessayez dans un instant.", "conflit");
      throw e;
    }
    return { commit: commit.sha, fichiers: entrees.map((e) => e.path) };
  }

  return async function gerer(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: entetesCors(req, env) });
    try {
      if (!origineAutorisee(req, env)) throw new ErreurHttp(403, "Origine non autorisée.", "origine");
      if (url.pathname === "/" && env.REDIRECTION_RACINE) return Response.redirect(new URL(env.REDIRECTION_RACINE, url).toString(), 302);
      if (url.pathname === "/" || url.pathname === "/api/sante") return json(req, env, 200, { ok: true, service: "administration Marleine Koula", branche: env.GITHUB_BRANCH || "main" });
      if (req.method === "GET" && url.pathname === "/api/config") {
        // Réglages publics de connexion (identiques à ceux d'une application Web Firebase : aucun secret).
        if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) throw new ErreurHttp(503, "La connexion n'est pas encore configurée.", "configuration");
        return json(req, env, 200, { firebase: { apiKey: env.FIREBASE_API_KEY, authDomain: env.FIREBASE_AUTH_DOMAIN || env.FIREBASE_PROJECT_ID + ".firebaseapp.com", projectId: env.FIREBASE_PROJECT_ID },
          methodes: String(env.ALLOWED_PROVIDERS || "google.com").split(",").map((s) => s.trim()), essai: (env.GITHUB_BRANCH || "main") !== "main" });
      }
      const utilisateur = await authentifier(req, env);
      if (req.method === "GET" && url.pathname === "/api/session") return json(req, env, 200, { email: utilisateur.email });
      if (req.method === "GET" && url.pathname === "/api/contenu") return json(req, env, 200, await lireContenu(env));
      if (req.method === "POST" && url.pathname === "/api/photo") return json(req, env, 200, await envoyerPhoto(req, env, url));
      if (req.method === "POST" && url.pathname === "/api/publier") return json(req, env, 200, await publier(req, env, utilisateur));
      throw new ErreurHttp(404, "Adresse inconnue.", "introuvable");
    } catch (e) {
      if (e instanceof ErreurHttp) {
        if (e.code === "github") console.error(e.message, e.details);
        const message = e.code === "github" ? "Le site n'a pas pu être joint pour le moment. Réessayez dans quelques minutes." : e.message;
        return json(req, env, e.statut, { erreur: message, code: e.code });
      }
      console.error(e && e.stack || e);
      return json(req, env, 500, { erreur: "Erreur inattendue du serveur. Réessayez dans quelques minutes.", code: "interne" });
    }
  };
}
