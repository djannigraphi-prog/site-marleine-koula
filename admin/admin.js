/* Administration Marleine Koula.
   Connexion : Firebase Authentication (compte Google ; e-mail + mot de passe si activé).
   Seuls les comptes autorisés côté serveur (ADMIN_EMAILS) peuvent lire et publier.
   Données : lues et publiées par le serveur sécurisé (Cloudflare Worker), qui écrit dans le dépôt GitHub.
   « Enregistrer » garde la modification en brouillon sur cet appareil ; « Publier » met tout en ligne. */
import { initializeApp, getAuth, connectAuthEmulator, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithPopup, GoogleAuthProvider, signInWithCredential } from "./vendor/firebase-auth-12.19.0.js";
import { SECTIONS_SITE } from "./schema.js";

const C = window.MK_ADMIN || {};
const SITE = C.site || "/";
const LIEN_SITE = C.lienSite || SITE;
const API = String(C.api || location.origin).replace(/\/$/, "");
const CLE_BROUILLON = "mk-admin-brouillon-v1";
const PHOTO_MAX_ENTREE = 15 * 1024 * 1024;
const PHOTO_COTE_MAX = 1600;
const NOMS_FICHIERS = { produits: "Articles", categories: "Catégories", prestations: "Prestations", site: "Textes & contacts" };

const I = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/></svg>',
  haut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  bas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  fermer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  envoyer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
};

/* ---------- Outils ---------- */
const $ = (sel, racine = document) => racine.querySelector(sel);
const echap = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cloner = (o) => JSON.parse(JSON.stringify(o));
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const formatPrix = (n) => (n === null || n === undefined || n === "") ? "Prix sur demande" : Number(n).toLocaleString("fr-FR").replace(/\s/g, " ") + " FCFA";
const lireStockage = (cle) => { try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } };
const ecrireStockage = (cle, v) => { try { if (v === null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); return true; } catch { return false; } };

function toast(message, type = "", duree = 4000) {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = message;
  const zone = $("#toasts");
  while (zone.children.length >= 2) zone.firstElementChild.remove();
  zone.append(el);
  setTimeout(() => el.remove(), duree);
}

function voile(texte) {
  fermerVoile();
  const el = document.createElement("div");
  el.className = "voile"; el.id = "voile";
  el.innerHTML = '<div class="boite"><div class="rouage" aria-hidden="true"></div><p><strong>' + echap(texte) + "</strong></p></div>";
  document.body.append(el);
}
function fermerVoile() { $("#voile")?.remove(); }

/* ---------- État ---------- */
const E = {
  auth: null,
  email: "",
  base: null,          // version du site sur laquelle reposent les modifications
  original: null,      // contenu publié au chargement
  brouillon: null,     // contenu avec les modifications enregistrées
  photos: {},          // photos envoyées mais pas encore en ligne : chemin -> { sha, apercu }
  onglet: "produits",
  recherche: "",
  filtreCat: "",
  publication: null,   // { etat: "attente" | "ok", fichiers }
};

function fichiersModifies() {
  if (!E.original) return [];
  return Object.keys(NOMS_FICHIERS).filter((n) => !egal(E.original[n], E.brouillon[n]));
}

function sauverBrouillon() {
  const modifies = fichiersModifies();
  if (!modifies.length) { ecrireStockage(CLE_BROUILLON, null); return; }
  const fichiers = {};
  modifies.forEach((n) => { fichiers[n] = E.brouillon[n]; });
  const photos = Object.entries(E.photos).map(([chemin, p]) => ({ chemin, sha: p.sha, apercu: p.apercu }));
  const ok = ecrireStockage(CLE_BROUILLON, { base: E.base, date: Date.now(), email: E.email, fichiers, photos });
  if (!ok) ecrireStockage(CLE_BROUILLON, { base: E.base, date: Date.now(), email: E.email, fichiers, photos: photos.map((p) => ({ ...p, apercu: "" })) });
}

function enregistrer(message) {
  sauverBrouillon();
  rendre();
  toast(message || "Enregistré. Pensez à publier pour mettre en ligne.", "succes");
}

/* ---------- API du serveur ---------- */
class ErreurApi extends Error { constructor(statut, message, code) { super(message); this.statut = statut; this.code = code; } }

async function api(chemin, options = {}) {
  const u = E.auth.currentUser;
  if (!u) throw new ErreurApi(401, "Veuillez vous reconnecter.", "non_connecte");
  const jeton = await u.getIdToken();
  let r;
  try {
    r = await fetch(API + chemin, { ...options, headers: { ...(options.headers || {}), Authorization: "Bearer " + jeton } });
  } catch (e) {
    throw new ErreurApi(0, navigator.onLine === false ? "Pas de connexion internet. Vérifiez votre réseau puis réessayez." : "Le serveur d'administration ne répond pas. Vérifiez votre connexion et réessayez.", "reseau");
  }
  let donnees = {};
  try { donnees = await r.json(); } catch { /* réponse vide */ }
  if (!r.ok) {
    const err = new ErreurApi(r.status, donnees.erreur || "Erreur " + r.status, donnees.code);
    if (r.status === 401) { await signOut(E.auth); afficherConnexion({ message: "Votre session a expiré. Veuillez vous reconnecter.", type: "info" }); }
    if (r.status === 403 && donnees.code === "non_autorise") afficherRefus();
    throw err;
  }
  return donnees;
}

/* ---------- Démarrage et connexion ---------- */
function ecranInfo(titre, texte) {
  $("#app").innerHTML = `<div class="ecran-centre"><div class="carte-connexion"><img src="/assets/logo/logo-mk-rond.png" alt="" class="logo-connexion"><h1>${echap(titre)}</h1><p class="sous-titre">${texte}</p></div></div>`;
}

async function demarrer() {
  let firebase = C.firebase && C.firebase.apiKey ? C.firebase : null;
  E.methodes = C.methodes || null;
  if (!firebase || !E.methodes) {
    // Les réglages publics de connexion sont fournis par le serveur d'administration.
    try {
      const r = await fetch(API + "/api/config", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      firebase = firebase || d.firebase;
      E.methodes = E.methodes || d.methodes;
      E.essai = !!d.essai;
    } catch {
      return ecranInfo("Administration", "L'espace d'administration est en cours de mise en place, ou le serveur ne répond pas. Réessayez dans quelques minutes.");
    }
  }
  E.methodes = E.methodes || ["google.com"];
  const app = initializeApp(firebase);
  E.auth = getAuth(app);
  E.auth.languageCode = "fr";
  if (C.emulateurAuth) {
    // Tests automatiques uniquement (émulateur Firebase) : compte Google simulé.
    connectAuthEmulator(E.auth, C.emulateurAuth, { disableWarnings: true });
    window.__mkConnexionTest = (email, verifie = true) => signInWithCredential(E.auth, GoogleAuthProvider.credential(JSON.stringify({ sub: "test-" + email + (verifie ? "" : "-non-verifie"), email, email_verified: verifie })));
  }
  setPersistence(E.auth, browserLocalPersistence).catch(() => {});
  onAuthStateChanged(E.auth, (u) => { if (u) ouvrirSession(u); else afficherConnexion(); });
}

const ICONE_GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

function messageErreurGoogle(code) {
  switch (code) {
    case "auth/popup-blocked": return "La fenêtre de connexion Google a été bloquée. Autorisez les fenêtres pop-up pour ce site, puis réessayez.";
    case "auth/unauthorized-domain": return "Cette adresse n'est pas encore autorisée pour la connexion Google (réglage Firebase « Domaines autorisés »).";
    case "auth/operation-not-allowed": return "La connexion Google n'est pas activée dans Firebase.";
    case "auth/network-request-failed": return "Pas de connexion internet. Vérifiez votre réseau puis réessayez.";
    case "auth/too-many-requests": return "Trop de tentatives. Patientez quelques minutes puis réessayez.";
    case "auth/user-disabled": return "Ce compte a été désactivé.";
    default: return "La connexion a échoué. Réessayez dans un instant.";
  }
}

function afficherConnexionGoogle(opts = {}) {
  const msg = opts.message ? '<p class="alerte ' + (opts.type || "info") + '" role="alert">' + echap(opts.message) + "</p>" : "";
  $("#app").innerHTML = `
  <div class="ecran-centre"><div class="carte-connexion">
    <img src="/assets/logo/logo-mk-rond.png" alt="" class="logo-connexion">
    <h1>Espace administration</h1>
    <p class="sous-titre">Marleine Koula · Salon de beauté</p>
    ${E.essai ? '<p class="alerte info" style="margin-bottom:14px"><strong>Version d\'essai.</strong> Les publications faites ici ne modifient pas le site public.</p>' : ""}
    <div style="display:grid;gap:14px">
      ${msg}
      <button class="btn large btn-google" id="btn-google" type="button">${ICONE_GOOGLE}Se connecter avec Google</button>
      <p id="erreur-connexion" class="alerte erreur" role="alert" hidden></p>
      <p class="aide" style="text-align:center;color:var(--cacao-doux);font-size:14px">Réservé au compte Google du salon.</p>
    </div>
  </div></div>`;
  $("#btn-google").onclick = async () => {
    const b = $("#btn-google"), zone = $("#erreur-connexion");
    zone.hidden = true; b.disabled = true;
    try {
      const fournisseur = new GoogleAuthProvider();
      fournisseur.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(E.auth, fournisseur);
    } catch (err) {
      b.disabled = false;
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      zone.textContent = messageErreurGoogle(err.code); zone.hidden = false;
    }
  };
}

function messageErreurConnexion(code) {
  switch (code) {
    case "auth/invalid-credential": case "auth/wrong-password": case "auth/user-not-found": case "auth/invalid-login-credentials":
      return "E-mail ou mot de passe incorrect.";
    case "auth/invalid-email": return "Cette adresse e-mail n'est pas valide.";
    case "auth/too-many-requests": return "Trop de tentatives. Patientez quelques minutes, ou utilisez « Mot de passe oublié ».";
    case "auth/network-request-failed": return "Pas de connexion internet. Vérifiez votre réseau puis réessayez.";
    case "auth/user-disabled": return "Ce compte a été désactivé.";
    case "auth/missing-password": return "Saisissez votre mot de passe.";
    default: return "La connexion a échoué. Réessayez dans un instant.";
  }
}

function afficherConnexion(opts = {}) {
  E.email = "";
  if (!(E.methodes || []).includes("password")) return afficherConnexionGoogle(opts);
  const msg = opts.message ? '<p class="alerte ' + (opts.type || "info") + '" role="alert">' + echap(opts.message) + "</p>" : "";
  $("#app").innerHTML = `
  <div class="ecran-centre"><div class="carte-connexion">
    <img src="/assets/logo/logo-mk-rond.png" alt="" class="logo-connexion">
    <h1>Espace administration</h1>
    <p class="sous-titre">Marleine Koula · Salon de beauté</p>
    <form id="form-connexion" novalidate>
      ${msg}
      <div class="champ"><label for="email">Adresse e-mail</label>
        <input id="email" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required value="${echap(opts.email || lireStockage("mk-admin-email") || "")}"></div>
      <div class="champ"><label for="mdp">Mot de passe</label>
        <div class="mdp"><input id="mdp" type="password" autocomplete="current-password" required><button type="button" id="voir-mdp" aria-pressed="false">Afficher</button></div></div>
      <p id="erreur-connexion" class="alerte erreur" role="alert" hidden></p>
      <button class="btn large" type="submit" id="btn-connexion">Se connecter</button>
      <button class="btn lien" type="button" id="lien-oubli">Mot de passe oublié ?</button>
    </form>
  </div></div>`;
  $("#voir-mdp").onclick = (e) => { const i = $("#mdp"); const v = i.type === "password"; i.type = v ? "text" : "password"; e.target.textContent = v ? "Masquer" : "Afficher"; e.target.setAttribute("aria-pressed", String(v)); };
  $("#lien-oubli").onclick = () => afficherOubli($("#email").value.trim());
  $("#form-connexion").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim(), mdp = $("#mdp").value;
    const zone = $("#erreur-connexion");
    zone.hidden = true;
    if (!email || !mdp) { zone.textContent = "Saisissez votre e-mail et votre mot de passe."; zone.hidden = false; return; }
    const b = $("#btn-connexion"); b.disabled = true; b.textContent = "Connexion…";
    try {
      await signInWithEmailAndPassword(E.auth, email, mdp);
      ecrireStockage("mk-admin-email", email);
    } catch (err) {
      zone.textContent = messageErreurConnexion(err.code); zone.hidden = false;
      b.disabled = false; b.textContent = "Se connecter";
    }
  };
  (opts.email || lireStockage("mk-admin-email") ? $("#mdp") : $("#email")).focus();
}

function afficherOubli(email) {
  $("#app").innerHTML = `
  <div class="ecran-centre"><div class="carte-connexion">
    <img src="/assets/logo/logo-mk-rond.png" alt="" class="logo-connexion">
    <h1>Mot de passe oublié</h1>
    <p class="sous-titre">Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    <form id="form-oubli" novalidate>
      <div class="champ"><label for="email-oubli">Adresse e-mail</label>
        <input id="email-oubli" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required value="${echap(email || "")}"></div>
      <p id="msg-oubli" role="alert" hidden></p>
      <button class="btn large" type="submit" id="btn-oubli">Recevoir le lien</button>
      <button class="btn lien" type="button" id="retour-connexion">← Retour à la connexion</button>
    </form>
  </div></div>`;
  $("#retour-connexion").onclick = () => afficherConnexion({ email: $("#email-oubli").value.trim() });
  $("#form-oubli").onsubmit = async (e) => {
    e.preventDefault();
    const adresse = $("#email-oubli").value.trim();
    const zone = $("#msg-oubli"), b = $("#btn-oubli");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) { zone.className = "alerte erreur"; zone.textContent = "Saisissez une adresse e-mail valide."; zone.hidden = false; return; }
    b.disabled = true; b.textContent = "Envoi…";
    try {
      await sendPasswordResetEmail(E.auth, adresse, { url: location.origin + location.pathname });
      zone.className = "alerte succes";
      zone.textContent = "Si cette adresse correspond à un compte, un e-mail vient d'être envoyé. Ouvrez-le et suivez le lien (pensez à regarder dans les courriers indésirables).";
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        zone.className = "alerte succes";
        zone.textContent = "Si cette adresse correspond à un compte, un e-mail vient d'être envoyé. Ouvrez-le et suivez le lien (pensez à regarder dans les courriers indésirables).";
      } else { zone.className = "alerte erreur"; zone.textContent = messageErreurConnexion(err.code); }
    }
    zone.hidden = false; b.disabled = false; b.textContent = "Recevoir le lien";
  };
}

function afficherRefus() {
  $("#app").innerHTML = `
  <div class="ecran-centre"><div class="carte-connexion">
    <img src="/assets/logo/logo-mk-rond.png" alt="" class="logo-connexion">
    <h1>Accès refusé</h1>
    <p class="sous-titre">Le compte <strong>${echap(E.auth.currentUser?.email || "")}</strong> n'est pas autorisé à administrer ce site. Connectez-vous avec le compte du salon.</p>
    <button class="btn large" id="btn-refus">Utiliser un autre compte</button>
  </div></div>`;
  $("#btn-refus").onclick = () => signOut(E.auth);
}

async function ouvrirSession(u) {
  $("#app").innerHTML = '<div class="ecran-centre"><div class="carte-connexion" style="text-align:center"><img src="/assets/logo/logo-mk-rond.png" alt="" class="logo-connexion"><div class="rouage" style="margin:8px auto"></div><p>Chargement de votre site…</p></div></div>';
  try {
    const session = await api("/api/session");
    E.email = session.email;
    const { base, fichiers } = await api("/api/contenu");
    E.original = fichiers;
    E.brouillon = cloner(fichiers);
    E.base = base;
    E.photos = {};
    const b = lireStockage(CLE_BROUILLON);
    rendreSquelette();
    rendre();
    if (b && b.fichiers && Object.keys(b.fichiers).length) proposerReprise(b);
  } catch (e) {
    if (e.statut === 401 || (e.statut === 403 && e.code === "non_autorise")) return;
    $("#app").innerHTML = `<div class="ecran-centre"><div class="carte-connexion"><img src="/assets/logo/logo-mk-rond.png" alt="" class="logo-connexion"><h1>Oups</h1><p class="alerte erreur" style="margin:14px 0">${echap(e.message)}</p><div style="display:grid;gap:10px"><button class="btn large" id="reessayer">Réessayer</button><button class="btn contour large" id="deco">Se déconnecter</button></div></div></div>`;
    $("#reessayer").onclick = () => ouvrirSession(u);
    $("#deco").onclick = () => signOut(E.auth);
  }
}

function proposerReprise(b) {
  const quand = new Date(b.date).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const liste = Object.keys(b.fichiers).map((n) => NOMS_FICHIERS[n]).join(", ");
  const autreVersion = b.base !== E.base;
  fenetre({
    titre: "Modifications non publiées", petite: true,
    corps: `<p>Vous avez des modifications enregistrées le <strong>${echap(quand)}</strong> qui ne sont pas encore en ligne : <strong>${echap(liste)}</strong>.</p>
      ${autreVersion ? '<p class="alerte info">Le site a été mis à jour depuis. Si les mêmes pages ont changé, il faudra peut-être refaire vos modifications.</p>' : ""}`,
    boutons: [
      { texte: "Les abandonner", classe: "contour", action: (f) => { ecrireStockage(CLE_BROUILLON, null); f.close(); toast("Modifications abandonnées."); } },
      { texte: "Les reprendre", action: (f) => {
        for (const [n, contenu] of Object.entries(b.fichiers)) E.brouillon[n] = contenu;
        E.base = b.base;
        (b.photos || []).forEach((p) => { E.photos[p.chemin] = { sha: p.sha, apercu: p.apercu }; });
        f.close(); rendre(); toast("Modifications reprises.", "succes");
      } },
    ],
  });
}

/* ---------- Squelette de l'administration ---------- */
const ONGLETS = [["produits", "Articles"], ["categories", "Catégories"], ["prestations", "Prestations"], ["site", "Textes & contacts"]];

function rendreSquelette() {
  $("#app").innerHTML = `
  <header class="entete"><div class="entete-int">
    <img src="/assets/logo/logo-mk-rond.png" alt="">
    <div class="titre">Administration${E.essai ? " · essai" : ""}<small>${echap(E.email)}</small></div>
    <div class="actions">
      <a class="btn contour petit masquer-mobile" href="${echap(LIEN_SITE)}" target="_blank" rel="noopener">Voir le site</a>
      <button class="btn contour petit" id="btn-deconnexion">Se déconnecter</button>
    </div>
  </div></header>
  <nav class="onglets" aria-label="Sections"><div class="onglets-int" role="tablist" id="onglets"></div></nav>
  <main class="principal" id="principal" tabindex="-1"></main>
  <div id="zone-publier"></div>`;
  $("#btn-deconnexion").onclick = deconnecter;
  window.onbeforeunload = () => (E.publication?.etat === "envoi" ? true : undefined);
}

function deconnecter() {
  if (fichiersModifies().length) {
    fenetre({
      titre: "Se déconnecter ?", petite: true,
      corps: "<p>Vos modifications non publiées restent enregistrées sur cet appareil. Vous pourrez les publier à votre prochaine connexion.</p>",
      boutons: [{ texte: "Annuler", classe: "contour", action: (f) => f.close() }, { texte: "Se déconnecter", action: (f) => { f.close(); signOut(E.auth); } }],
    });
  } else signOut(E.auth);
}

function rendre() {
  if (!$("#principal")) return;
  const modifies = fichiersModifies();
  $("#onglets").innerHTML = ONGLETS.map(([cle, nom]) => {
    const n = modifies.includes(cle) ? '<span class="pastille" title="Modifié, pas encore publié">•</span>' : "";
    return `<button class="onglet" role="tab" aria-selected="${E.onglet === cle}" data-onglet="${cle}">${nom}${n}</button>`;
  }).join("");
  $("#onglets").querySelectorAll("[data-onglet]").forEach((b) => b.onclick = () => { E.onglet = b.dataset.onglet; rendre(); window.scrollTo({ top: 0 }); });
  ({ produits: rendreArticles, categories: rendreCategories, prestations: rendrePrestations, site: rendreSite })[E.onglet]();
  rendreBarrePublier();
}

/* ---------- Photos ---------- */
function srcPhoto(chemin) {
  if (!chemin) return "";
  if (E.photos[chemin]?.apercu) return E.photos[chemin].apercu;
  return SITE.replace(/\/?$/, "/") + chemin;
}

function vignette(chemin, alt) {
  return chemin ? `<img src="${echap(srcPhoto(chemin))}" alt="${echap(alt || "")}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('small'),{textContent:'Photo en cours de mise en ligne'}))">` : I.photo;
}

function chargerImage(fichier) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => { ok({ source: img, largeur: img.naturalWidth, hauteur: img.naturalHeight, liberer: () => URL.revokeObjectURL(url) }); };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("decodage")); };
    img.src = url;
  });
}

function canvasVersBlob(canvas, type, qualite) { return new Promise((ok) => canvas.toBlob(ok, type, qualite)); }
function blobVersBase64(blob) { return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(blob); }); }

/** Vérifie, redimensionne et compresse une photo. Renvoie { base64, ext, apercu } ou lève une erreur lisible. */
async function preparerPhoto(fichier, { logo = false } = {}) {
  const nom = (fichier.name || "").toLowerCase();
  const type = fichier.type || "";
  const heic = /heic|heif/.test(type) || /\.(heic|heif)$/.test(nom);
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(type) && !/\.(jpe?g|png|webp|heic|heif)$/.test(nom)) {
    throw new Error("Ce fichier n'est pas une photo acceptée. Formats acceptés : JPG, PNG, WebP (et HEIC sur iPhone).");
  }
  if (fichier.size > PHOTO_MAX_ENTREE) throw new Error("Cette photo est trop lourde (" + (fichier.size / 1048576).toFixed(1).replace(".", ",") + " Mo). Choisissez une photo de moins de 15 Mo.");
  let image;
  try { image = await chargerImage(fichier); }
  catch {
    throw new Error(heic ? "Ce navigateur ne sait pas lire les photos HEIC de l'iPhone. Sur iPhone : Réglages › Appareil photo › Formats › « Le plus compatible », ou envoyez la photo depuis Safari." : "Cette photo n'a pas pu être lue. Elle est peut-être abîmée : essayez une autre photo.");
  }
  try {
    if (image.largeur < 200 || image.hauteur < 200) throw new Error("Cette photo est trop petite (" + image.largeur + "×" + image.hauteur + " pixels). Choisissez une photo d'au moins 200 pixels de côté.");
    const echelle = Math.min(1, PHOTO_COTE_MAX / Math.max(image.largeur, image.hauteur));
    const l = Math.round(image.largeur * echelle), h = Math.round(image.hauteur * echelle);
    const canvas = document.createElement("canvas");
    canvas.width = l; canvas.height = h;
    const ctx = canvas.getContext("2d");
    const garderPng = logo && /png|webp/.test(type);
    if (!garderPng) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, l, h); }
    ctx.drawImage(image.source, 0, 0, l, h);
    let blob, ext;
    if (garderPng) { blob = await canvasVersBlob(canvas, "image/png"); ext = "png"; }
    if (!blob || blob.size > 1.5 * 1048576) {
      ext = "jpg";
      for (const q of [0.85, 0.78, 0.7, 0.6]) { blob = await canvasVersBlob(canvas, "image/jpeg", q); if (blob && blob.size < 900 * 1024) break; }
    }
    if (!blob) throw new Error("La photo n'a pas pu être préparée. Essayez une autre photo.");
    // Petite vignette pour l'aperçu (gardée sur l'appareil jusqu'à la publication)
    const v = document.createElement("canvas");
    const ev = Math.min(1, 480 / Math.max(l, h));
    v.width = Math.round(l * ev); v.height = Math.round(h * ev);
    const vctx = v.getContext("2d");
    if (!garderPng) { vctx.fillStyle = "#ffffff"; vctx.fillRect(0, 0, v.width, v.height); }
    vctx.drawImage(canvas, 0, 0, v.width, v.height);
    const apercu = garderPng ? v.toDataURL("image/png") : v.toDataURL("image/jpeg", 0.8);
    return { base64: await blobVersBase64(blob), ext, apercu };
  } finally { image.liberer(); }
}

async function envoyerPhoto(fichier, indice, opts) {
  const p = await preparerPhoto(fichier, opts);
  const r = await api("/api/photo?ext=" + p.ext + "&nom=" + encodeURIComponent(indice || "photo"), { method: "POST", headers: { "Content-Type": "text/plain" }, body: p.base64 });
  E.photos[r.chemin] = { sha: r.sha, apercu: p.apercu };
  return r.chemin;
}

/** Zone photo réutilisable dans les formulaires. Renvoie { html, brancher(racine), valeur() }. */
function zonePhoto(id, valeurInitiale, { indice = () => "photo", logo = false, etiquette = "Photo" } = {}) {
  let valeur = valeurInitiale || "";
  const html = `<div class="champ"><span class="etiquette">${echap(etiquette)}</span>
    <div class="zone-photo" id="${id}">
      <div class="apercu ${logo ? "logo" : ""}" data-apercu></div>
      <div class="actions-photo">
        <label class="btn contour petit" data-choisir tabindex="0"><span data-libelle></span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" class="visuellement-cache" data-fichier></label>
        <button type="button" class="btn danger-contour petit" data-retirer>Retirer la photo</button>
        <span class="progression" data-progression hidden></span>
        <span class="msg-erreur" data-erreur role="alert" hidden></span>
        <span class="aide">JPG, PNG ou WebP · 15 Mo maximum · réduite automatiquement</span>
      </div>
    </div></div>`;
  function maj(racine) {
    const z = racine.querySelector("#" + id);
    z.querySelector("[data-apercu]").innerHTML = valeur ? `<img src="${echap(srcPhoto(valeur))}" alt="Aperçu">` : "Aucune photo";
    z.querySelector("[data-libelle]").textContent = valeur ? "Remplacer la photo" : "Ajouter une photo";
    z.querySelector("[data-retirer]").hidden = !valeur;
  }
  return {
    html,
    valeur: () => valeur,
    enCours: false,
    brancher(racine) {
      const z = racine.querySelector("#" + id), self = this;
      maj(racine);
      z.querySelector("[data-choisir]").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); z.querySelector("[data-fichier]").click(); } };
      z.querySelector("[data-retirer]").onclick = () => { valeur = ""; maj(racine); };
      z.querySelector("[data-fichier]").onchange = async (e) => {
        const f = e.target.files[0]; e.target.value = "";
        if (!f) return;
        const prog = z.querySelector("[data-progression]"), err = z.querySelector("[data-erreur]");
        err.hidden = true; prog.hidden = false; prog.textContent = "Préparation et envoi de la photo…";
        self.enCours = true; z.querySelector("[data-choisir]").style.pointerEvents = "none";
        try { valeur = await envoyerPhoto(f, indice(), { logo }); maj(racine); prog.textContent = "Photo prête ✓"; setTimeout(() => { prog.hidden = true; }, 2500); }
        catch (ex) { prog.hidden = true; err.textContent = ex.message; err.hidden = false; }
        finally { self.enCours = false; z.querySelector("[data-choisir]").style.pointerEvents = ""; }
      };
    },
  };
}

/* ---------- Fenêtres ---------- */
function fenetre({ titre, corps, boutons = [], petite = false, pleine = false, apresOuverture, avantFermeture }) {
  const d = document.createElement("dialog");
  d.className = (petite ? "petit" : "") + (pleine ? " plein" : "");
  d.setAttribute("aria-label", titre);
  d.innerHTML = `<form class="fenetre" method="dialog" novalidate>
    <div class="fenetre-tete"><h2>${echap(titre)}</h2><button type="button" class="btn contour icone" data-fermer aria-label="Fermer">${I.fermer}</button></div>
    <div class="fenetre-corps">${corps}</div>
    <div class="fenetre-pied"></div></form>`;
  const pied = d.querySelector(".fenetre-pied");
  boutons.forEach((b, i) => {
    const el = document.createElement("button");
    el.type = b.soumettre ? "submit" : "button";
    el.className = "btn " + (b.classe || "");
    el.textContent = b.texte;
    el.onclick = (e) => { e.preventDefault(); b.action(d, e); };
    pied.append(el);
  });
  const fermer = () => { if (!avantFermeture || avantFermeture() !== false) d.close(); };
  d.querySelector("[data-fermer]").onclick = fermer;
  d.addEventListener("cancel", (e) => { e.preventDefault(); fermer(); });
  d.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const s = boutons.find((b) => b.soumettre); if (s) s.action(d, e); });
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
  apresOuverture?.(d);
  return d;
}

function confirmer({ titre, texte, bouton = "Supprimer", danger = true }) {
  return new Promise((ok) => {
    let rep = false;
    const d = fenetre({ titre, petite: true, corps: `<p>${texte}</p>`, boutons: [
      { texte: "Annuler", classe: "contour", action: (f) => f.close() },
      { texte: bouton, classe: danger ? "danger" : "", action: (f) => { rep = true; f.close(); } },
    ] });
    d.addEventListener("close", () => ok(rep));
  });
}

function lireNombre(valeur) {
  const v = String(valeur ?? "").replace(/[\s  .]/g, "").replace(",", ".");
  if (v === "") return { ok: true, n: null };
  if (!/^\d+$/.test(v)) return { ok: false };
  return { ok: true, n: Number(v) };
}

function erreurChamp(racine, id, message) {
  const champ = racine.querySelector("#" + id)?.closest(".champ");
  if (!champ) return;
  champ.classList.toggle("erreur", !!message);
  let m = champ.querySelector(".msg-erreur");
  if (message) { if (!m) { m = document.createElement("span"); m.className = "msg-erreur"; champ.append(m); } m.textContent = message; }
  else m?.remove();
}

/* ---------- Articles ---------- */
function produits() { return E.brouillon.produits.produits; }
function categoriesNoms() { return E.brouillon.categories.categories.map((c) => c.nom); }

function estModifie(fichier, liste, el) {
  const orig = E.original[fichier][liste] || [];
  return !orig.some((o) => egal(o, el));
}

function rendreArticles() {
  const liste = produits();
  const q = E.recherche.toLowerCase();
  const visibles = liste.map((p, i) => ({ p, i })).filter(({ p }) =>
    (!E.filtreCat || p.categorie === E.filtreCat) && (!q || (p.nom + " " + (p.description || "") + " " + (p.details || "")).toLowerCase().includes(q)));
  const filtre = !!(q || E.filtreCat);
  $("#principal").innerHTML = `
    <div class="barre-titre"><h2>Articles <small style="font-size:16px;color:var(--cacao-doux)">(${liste.length})</small></h2>
      <button class="btn or" id="ajouter-article">${I.plus}Ajouter un article</button></div>
    <div class="filtres">
      <div class="champ"><label class="visuellement-cache" for="recherche">Rechercher</label><input type="search" id="recherche" placeholder="Rechercher un article…" value="${echap(E.recherche)}"></div>
      <div class="champ"><label class="visuellement-cache" for="filtre-cat">Catégorie</label><select id="filtre-cat"><option value="">Toutes les catégories</option>${categoriesNoms().map((c) => `<option ${c === E.filtreCat ? "selected" : ""}>${echap(c)}</option>`).join("")}</select></div>
    </div>
    ${visibles.length ? `<div class="liste">${visibles.map(({ p, i }) => carteArticle(p, i, filtre, liste.length)).join("")}</div>` : `<div class="vide">${liste.length ? "Aucun article ne correspond à votre recherche." : "Aucun article pour le moment. Touchez « Ajouter un article »."}</div>`}`;
  $("#ajouter-article").onclick = () => editerArticle(-1);
  $("#recherche").oninput = (e) => { E.recherche = e.target.value; const pos = e.target.selectionStart; rendreArticles(); const r = $("#recherche"); r.focus(); r.setSelectionRange(pos, pos); };
  $("#filtre-cat").onchange = (e) => { E.filtreCat = e.target.value; rendreArticles(); };
  $("#principal").querySelectorAll("[data-action]").forEach((b) => b.onclick = () => {
    const i = Number(b.dataset.i);
    ({ modifier: () => editerArticle(i), prix: () => editerPrix(i), supprimer: () => supprimerArticle(i), haut: () => deplacer("produits", "produits", i, -1), bas: () => deplacer("produits", "produits", i, 1) })[b.dataset.action]();
  });
}

function carteArticle(p, i, filtre, total) {
  const promo = p.prix_promo !== null && p.prix_promo !== undefined && p.prix_promo !== "";
  const badges = [
    estModifie("produits", "produits", p) ? '<span class="badge attente">Non publié</span>' : "",
    p.nouveaute ? '<span class="badge or">Nouveauté</span>' : "",
    p.accueil ? '<span class="badge">Page d\'accueil</span>' : "",
    p.disponible === false ? '<span class="badge rouge">Indisponible</span>' : "",
    promo ? '<span class="badge rouge">Promo</span>' : "",
  ].join("");
  return `<article class="carte ${estModifie("produits", "produits", p) ? "modifiee" : ""} ${p.disponible === false ? "indispo" : ""}">
    <div class="vignette">${vignette(p.image, p.nom)}</div>
    <div><h3>${echap(p.nom)}</h3><div class="meta">${echap(p.categorie || "Sans catégorie")}${p.details ? " · " + echap(p.details) : ""}</div>
      <div class="prix">${promo ? formatPrix(p.prix_promo) + "<s>" + formatPrix(p.prix) + "</s>" : formatPrix(p.prix)}</div>
      <div class="badges">${badges}</div></div>
    <div class="boutons">
      <button class="btn petit" data-action="modifier" data-i="${i}">Modifier</button>
      <button class="btn contour petit" data-action="prix" data-i="${i}">Modifier le prix</button>
      <button class="btn danger-contour petit" data-action="supprimer" data-i="${i}">Supprimer</button>
      ${filtre ? "" : `<span class="ordre"><button class="btn contour icone" data-action="haut" data-i="${i}" aria-label="Monter ${echap(p.nom)}" ${i === 0 ? "disabled" : ""}>${I.haut}</button><button class="btn contour icone" data-action="bas" data-i="${i}" aria-label="Descendre ${echap(p.nom)}" ${i === total - 1 ? "disabled" : ""}>${I.bas}</button></span>`}
    </div></article>`;
}

function deplacer(fichier, cle, i, sens) {
  const l = E.brouillon[fichier][cle];
  const j = i + sens;
  if (j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  enregistrer("Ordre modifié. Pensez à publier.");
}

function editerArticle(i) {
  const nouveau = i < 0;
  const p = nouveau ? { nom: "", categorie: E.filtreCat || categoriesNoms()[0] || "", description: "", prix: null, prix_promo: null, details: "", image: "", nouveaute: true, accueil: false, disponible: true } : cloner(produits()[i]);
  const nbAccueil = produits().filter((x, j) => x.accueil && j !== i).length;
  const photo = zonePhoto("photo-article", p.image, { indice: () => $("#a-nom")?.value || "article", etiquette: "Photo de l'article (carrée de préférence)" });
  const cats = categoriesNoms();
  const optCats = cats.map((c) => `<option ${c === p.categorie ? "selected" : ""}>${echap(c)}</option>`).join("") + (p.categorie && !cats.includes(p.categorie) ? `<option selected>${echap(p.categorie)}</option>` : "");
  fenetre({
    titre: nouveau ? "Ajouter un article" : "Modifier l'article", pleine: true,
    corps: `${photo.html}
      <div class="champ"><label for="a-nom">Nom de l'article *</label><input id="a-nom" type="text" maxlength="120" value="${echap(p.nom)}" required></div>
      <div class="champ"><label for="a-cat">Catégorie</label><select id="a-cat">${optCats || '<option value="">(Créez d\'abord une catégorie)</option>'}</select></div>
      <div class="grille-2">
        <div class="champ"><label for="a-prix">Prix</label><div class="prix-champ"><input id="a-prix" type="text" inputmode="numeric" value="${p.prix ?? ""}" placeholder="ex. 45000"><span>FCFA</span></div><span class="aide">Vide = « Prix sur demande »</span></div>
        <div class="champ"><label for="a-promo">Prix promo (facultatif)</label><div class="prix-champ"><input id="a-promo" type="text" inputmode="numeric" value="${p.prix_promo ?? ""}" placeholder="ex. 39000"><span>FCFA</span></div></div>
      </div>
      <div class="champ"><label for="a-desc">Description (1 à 3 phrases)</label><textarea id="a-desc" maxlength="1000">${echap(p.description)}</textarea></div>
      <div class="champ"><label for="a-det">Détails (longueur, texture, lace…)</label><input id="a-det" type="text" maxlength="200" value="${echap(p.details)}"></div>
      <label class="case"><input type="checkbox" id="a-dispo" ${p.disponible !== false ? "checked" : ""}><span><strong>Disponible à la vente</strong><small>Décochez si l'article est épuisé.</small></span></label>
      <label class="case"><input type="checkbox" id="a-nouv" ${p.nouveaute ? "checked" : ""}><span><strong>Nouveauté</strong><small>Affiche le badge « Nouveau ».</small></span></label>
      <label class="case"><input type="checkbox" id="a-acc" ${p.accueil ? "checked" : ""}><span><strong>Afficher sur la page d'accueil</strong><small>${nbAccueil} autre(s) article(s) déjà affiché(s) · 8 maximum.</small></span></label>`,
    boutons: [
      { texte: "Annuler", classe: "contour", action: (f) => f.close() },
      { texte: "Enregistrer", soumettre: true, action: (f) => {
        const r = f;
        if (photo.enCours) { toast("Patientez : la photo est en cours d'envoi.", "erreur"); return; }
        const nom = $("#a-nom", r).value.trim();
        const prix = lireNombre($("#a-prix", r).value), promo = lireNombre($("#a-promo", r).value);
        let ok = true;
        erreurChamp(r, "a-nom", nom ? "" : "Le nom est obligatoire."); if (!nom) ok = false;
        erreurChamp(r, "a-prix", prix.ok ? "" : "Saisissez un nombre entier, sans lettres (ex. 45000)."); if (!prix.ok) ok = false;
        erreurChamp(r, "a-promo", promo.ok ? (promo.n !== null && prix.n !== null && promo.n >= prix.n ? "Le prix promo doit être inférieur au prix normal." : "") : "Saisissez un nombre entier, sans lettres."); if (!promo.ok || (promo.n !== null && prix.n !== null && promo.n >= prix.n)) ok = false;
        const accueil = $("#a-acc", r).checked;
        if (accueil && nbAccueil >= 8) { erreurChamp(r, "a-acc", ""); toast("8 articles sont déjà sur la page d'accueil. Retirez-en un d'abord.", "erreur", 5000); ok = false; }
        if (!ok) { r.querySelector(".champ.erreur input, .champ.erreur textarea")?.focus(); return; }
        const art = { ...p, nom, categorie: $("#a-cat", r).value, description: $("#a-desc", r).value.trim(), prix: prix.n, prix_promo: promo.n, details: $("#a-det", r).value.trim(), image: photo.valeur(), nouveaute: $("#a-nouv", r).checked, accueil, disponible: $("#a-dispo", r).checked };
        if (nouveau) produits().unshift(art); else produits()[i] = art;
        f.close();
        enregistrer(nouveau ? "Article ajouté. Pensez à publier." : "Article enregistré. Pensez à publier.");
      } },
    ],
    apresOuverture: (d) => { photo.brancher(d); if (nouveau) $("#a-nom", d).focus(); },
  });
}

function editerPrix(i) {
  const p = produits()[i];
  fenetre({
    titre: "Modifier le prix", petite: true,
    corps: `<p><strong>${echap(p.nom)}</strong></p>
      <div class="champ"><label for="p-prix">Prix</label><div class="prix-champ"><input id="p-prix" type="text" inputmode="numeric" value="${p.prix ?? ""}"><span>FCFA</span></div><span class="aide">Vide = « Prix sur demande »</span></div>
      <div class="champ"><label for="p-promo">Prix promo (facultatif)</label><div class="prix-champ"><input id="p-promo" type="text" inputmode="numeric" value="${p.prix_promo ?? ""}"><span>FCFA</span></div><span class="aide">Laissez vide s'il n'y a pas de promotion.</span></div>`,
    boutons: [
      { texte: "Annuler", classe: "contour", action: (f) => f.close() },
      { texte: "Enregistrer", soumettre: true, action: (f) => {
        const prix = lireNombre($("#p-prix", f).value), promo = lireNombre($("#p-promo", f).value);
        erreurChamp(f, "p-prix", prix.ok ? "" : "Saisissez un nombre entier, sans lettres (ex. 45000).");
        const promoKo = !promo.ok || (promo.n !== null && prix.n !== null && promo.n >= prix.n);
        erreurChamp(f, "p-promo", !promo.ok ? "Saisissez un nombre entier, sans lettres." : promoKo ? "Le prix promo doit être inférieur au prix normal." : "");
        if (!prix.ok || promoKo) return;
        produits()[i] = { ...p, prix: prix.n, prix_promo: promo.n };
        f.close();
        enregistrer("Prix enregistré. Pensez à publier.");
      } },
    ],
    apresOuverture: (d) => { const el = $("#p-prix", d); el.focus(); el.select(); },
  });
}

async function supprimerArticle(i) {
  const p = produits()[i];
  if (await confirmer({ titre: "Supprimer l'article ?", texte: `« <strong>${echap(p.nom)}</strong> » sera retiré de la boutique après la publication.` })) {
    produits().splice(i, 1);
    enregistrer("Article supprimé. Pensez à publier.");
  }
}

/* ---------- Catégories ---------- */
function rendreCategories() {
  const liste = E.brouillon.categories.categories;
  $("#principal").innerHTML = `
    <div class="barre-titre"><h2>Catégories</h2><button class="btn or" id="ajouter-cat">${I.plus}Ajouter une catégorie</button></div>
    ${liste.length ? `<div class="liste">${liste.map((c, i) => {
      const n = produits().filter((p) => p.categorie === c.nom).length;
      const mod = estModifie("categories", "categories", c);
      return `<article class="carte ${mod ? "modifiee" : ""}"><div class="vignette">${vignette(c.image, c.nom)}</div>
        <div><h3>${echap(c.nom)}</h3><div class="meta">${echap(c.description || "")}</div>
          <div class="badges">${mod ? '<span class="badge attente">Non publié</span>' : ""}<span class="badge">${n} article${n > 1 ? "s" : ""}</span>${c.accueil !== false ? '<span class="badge">Page d\'accueil</span>' : ""}</div></div>
        <div class="boutons"><button class="btn petit" data-action="modifier" data-i="${i}">Modifier</button>
          <button class="btn danger-contour petit" data-action="supprimer" data-i="${i}">Supprimer</button>
          <span class="ordre"><button class="btn contour icone" data-action="haut" data-i="${i}" aria-label="Monter" ${i === 0 ? "disabled" : ""}>${I.haut}</button><button class="btn contour icone" data-action="bas" data-i="${i}" aria-label="Descendre" ${i === liste.length - 1 ? "disabled" : ""}>${I.bas}</button></span></div></article>`;
    }).join("")}</div>` : '<div class="vide">Aucune catégorie.</div>'}`;
  $("#ajouter-cat").onclick = () => editerCategorie(-1);
  $("#principal").querySelectorAll("[data-action]").forEach((b) => b.onclick = () => {
    const i = Number(b.dataset.i);
    ({ modifier: () => editerCategorie(i), supprimer: () => supprimerCategorie(i), haut: () => deplacer("categories", "categories", i, -1), bas: () => deplacer("categories", "categories", i, 1) })[b.dataset.action]();
  });
}

function editerCategorie(i) {
  const liste = E.brouillon.categories.categories;
  const nouveau = i < 0;
  const c = nouveau ? { nom: "", description: "", image: "", accueil: true } : cloner(liste[i]);
  const photo = zonePhoto("photo-cat", c.image, { indice: () => $("#c-nom")?.value || "categorie", etiquette: "Photo de la catégorie (verticale de préférence)" });
  fenetre({
    titre: nouveau ? "Ajouter une catégorie" : "Modifier la catégorie", pleine: true,
    corps: `${photo.html}
      <div class="champ"><label for="c-nom">Nom de la catégorie *</label><input id="c-nom" type="text" maxlength="60" value="${echap(c.nom)}"></div>
      <div class="champ"><label for="c-desc">Description courte</label><input id="c-desc" type="text" maxlength="160" value="${echap(c.description)}"></div>
      <label class="case"><input type="checkbox" id="c-acc" ${c.accueil !== false ? "checked" : ""}><span><strong>Afficher sur la page d'accueil</strong></span></label>`,
    boutons: [
      { texte: "Annuler", classe: "contour", action: (f) => f.close() },
      { texte: "Enregistrer", soumettre: true, action: (f) => {
        if (photo.enCours) { toast("Patientez : la photo est en cours d'envoi.", "erreur"); return; }
        const nom = $("#c-nom", f).value.trim();
        const doublon = liste.some((x, j) => j !== i && x.nom.toLowerCase() === nom.toLowerCase());
        erreurChamp(f, "c-nom", !nom ? "Le nom est obligatoire." : doublon ? "Une catégorie porte déjà ce nom." : "");
        if (!nom || doublon) return;
        const ancien = c.nom;
        const cat = { ...c, nom, description: $("#c-desc", f).value.trim(), image: photo.valeur(), accueil: $("#c-acc", f).checked };
        if (nouveau) liste.push(cat); else liste[i] = cat;
        let n = 0;
        if (!nouveau && ancien !== nom) produits().forEach((p) => { if (p.categorie === ancien) { p.categorie = nom; n++; } });
        f.close();
        enregistrer(nouveau ? "Catégorie ajoutée. Pensez à publier." : "Catégorie enregistrée" + (n ? " (" + n + " article(s) mis à jour)" : "") + ". Pensez à publier.");
      } },
    ],
    apresOuverture: (d) => photo.brancher(d),
  });
}

async function supprimerCategorie(i) {
  const c = E.brouillon.categories.categories[i];
  const n = produits().filter((p) => p.categorie === c.nom).length;
  if (n) {
    fenetre({ titre: "Suppression impossible", petite: true, corps: `<p>La catégorie « <strong>${echap(c.nom)}</strong> » contient ${n} article${n > 1 ? "s" : ""}. Changez leur catégorie ou supprimez-les d'abord.</p>`,
      boutons: [{ texte: "Compris", action: (f) => f.close() }] });
    return;
  }
  if (await confirmer({ titre: "Supprimer la catégorie ?", texte: `« <strong>${echap(c.nom)}</strong> » sera retirée du site après la publication.` })) {
    E.brouillon.categories.categories.splice(i, 1);
    enregistrer("Catégorie supprimée. Pensez à publier.");
  }
}

/* ---------- Prestations ---------- */
function rendrePrestations() {
  const liste = E.brouillon.prestations.prestations;
  $("#principal").innerHTML = `
    <div class="barre-titre"><h2>Prestations & tarifs</h2><button class="btn or" id="ajouter-presta">${I.plus}Ajouter une prestation</button></div>
    <p class="aide" style="margin:-6px 0 14px;color:var(--cacao-doux)">Tableau des tarifs affiché sur la page À propos.</p>
    ${liste.length ? `<div class="lignes">${liste.map((p, i) => `<div class="ligne ${estModifie("prestations", "prestations", p) ? "modifiee" : ""}">
      <div class="texte"><strong>${echap(p.nom)}</strong>${p.detail ? " · " + echap(p.detail) : ""}<small>${p.duree ? echap(p.duree) + " · " : ""}<span class="prix">${formatPrix(p.prix)}</span></small></div>
      <button class="btn petit" data-action="modifier" data-i="${i}">Modifier</button>
      <button class="btn danger-contour petit" data-action="supprimer" data-i="${i}">Supprimer</button>
      <span style="display:flex;gap:6px"><button class="btn contour icone" data-action="haut" data-i="${i}" aria-label="Monter" ${i === 0 ? "disabled" : ""}>${I.haut}</button><button class="btn contour icone" data-action="bas" data-i="${i}" aria-label="Descendre" ${i === liste.length - 1 ? "disabled" : ""}>${I.bas}</button></span>
    </div>`).join("")}</div>` : '<div class="vide">Aucune prestation.</div>'}`;
  $("#ajouter-presta").onclick = () => editerPrestation(-1);
  $("#principal").querySelectorAll("[data-action]").forEach((b) => b.onclick = async () => {
    const i = Number(b.dataset.i);
    if (b.dataset.action === "modifier") editerPrestation(i);
    else if (b.dataset.action === "haut") deplacer("prestations", "prestations", i, -1);
    else if (b.dataset.action === "bas") deplacer("prestations", "prestations", i, 1);
    else if (await confirmer({ titre: "Supprimer la prestation ?", texte: `« <strong>${echap(liste[i].nom)}${liste[i].detail ? " · " + echap(liste[i].detail) : ""}</strong> » sera retirée du tableau après la publication.` })) { liste.splice(i, 1); enregistrer("Prestation supprimée. Pensez à publier."); }
  });
}

function editerPrestation(i) {
  const liste = E.brouillon.prestations.prestations;
  const nouveau = i < 0;
  const p = nouveau ? { nom: "", detail: "", duree: "", prix: null } : cloner(liste[i]);
  fenetre({
    titre: nouveau ? "Ajouter une prestation" : "Modifier la prestation",
    corps: `<div class="champ"><label for="s-nom">Prestation *</label><input id="s-nom" type="text" maxlength="80" value="${echap(p.nom)}" placeholder="ex. Rajout"></div>
      <div class="champ"><label for="s-det">Détail</label><input id="s-det" type="text" maxlength="80" value="${echap(p.detail)}" placeholder="ex. Double raie"></div>
      <div class="grille-2"><div class="champ"><label for="s-duree">Durée</label><input id="s-duree" type="text" maxlength="40" value="${echap(p.duree)}" placeholder="ex. 1 h 30 max"></div>
      <div class="champ"><label for="s-prix">Prix</label><div class="prix-champ"><input id="s-prix" type="text" inputmode="numeric" value="${p.prix ?? ""}"><span>FCFA</span></div><span class="aide">Vide = « Prix sur demande »</span></div></div>`,
    boutons: [
      { texte: "Annuler", classe: "contour", action: (f) => f.close() },
      { texte: "Enregistrer", soumettre: true, action: (f) => {
        const nom = $("#s-nom", f).value.trim(), prix = lireNombre($("#s-prix", f).value);
        erreurChamp(f, "s-nom", nom ? "" : "Le nom est obligatoire.");
        erreurChamp(f, "s-prix", prix.ok ? "" : "Saisissez un nombre entier, sans lettres (ex. 5000).");
        if (!nom || !prix.ok) return;
        const s = { ...p, nom, detail: $("#s-det", f).value.trim(), duree: $("#s-duree", f).value.trim(), prix: prix.n };
        if (nouveau) liste.push(s); else liste[i] = s;
        f.close();
        enregistrer(nouveau ? "Prestation ajoutée. Pensez à publier." : "Prestation enregistrée. Pensez à publier.");
      } },
    ],
    apresOuverture: (d) => $("#s-nom", d).focus(),
  });
}

/* ---------- Textes & contacts ---------- */
function rendreSite() {
  $("#principal").innerHTML = `
    <div class="barre-titre"><h2>Textes & contacts</h2></div>
    <div class="sections">${SECTIONS_SITE.map((s, i) => {
      const mod = !egal(E.original.site[s.cle], E.brouillon.site[s.cle]);
      return `<div class="section-site"><div class="texte"><strong>${echap(s.titre)}</strong>${mod ? ' <span class="badge attente">Non publié</span>' : ""}<small>${echap(s.aide || "")}</small></div>
        <button class="btn petit" data-i="${i}">Modifier</button></div>`;
    }).join("")}</div>`;
  $("#principal").querySelectorAll("[data-i]").forEach((b) => b.onclick = () => editerSection(SECTIONS_SITE[Number(b.dataset.i)]));
}

let compteurId = 0;
function champHtml(def, valeur, prefixe, photos) {
  const id = prefixe + "-" + def.cle + "-" + (++compteurId);
  const lab = echap(def.label) + (def.obligatoire ? " *" : "");
  if (def.type === "texte") return `<div class="champ"><label for="${id}">${lab}</label><textarea id="${id}" data-cle="${def.cle}" maxlength="3000">${echap(valeur ?? "")}</textarea></div>`;
  if (def.type === "photo") { const z = zonePhoto(id, valeur, { logo: !!def.logo, etiquette: def.label, indice: () => def.cle }); photos.push({ cle: def.cle, zone: z, id }); return `<div data-photo="${id}">${z.html}</div>`; }
  if (def.type === "liste") {
    return `<div class="champ" data-liste="${def.cle}"><span class="etiquette">${lab}</span><div class="sous-liste">${(valeur || []).map((v) => sousLigneTexte(v)).join("")}</div>
      <button type="button" class="btn contour petit" data-ajouter-ligne style="justify-self:start">${I.plus}Ajouter un ${echap(def.singulier || "élément")}</button></div>`;
  }
  if (def.type === "cartes") {
    return `<div class="champ" data-cartes="${def.cle}"><span class="etiquette">${lab}</span><div class="sous-liste">${(valeur || []).map((v) => sousCarte(def, v, photos)).join("")}</div>
      <button type="button" class="btn contour petit" data-ajouter-carte style="justify-self:start">${I.plus}Ajouter un ${echap(def.singulier || "élément")}</button></div>`;
  }
  const t = def.type === "lien" ? "url" : "text";
  return `<div class="champ"><label for="${id}">${lab}</label><input id="${id}" type="${t}" data-cle="${def.cle}" data-type="${def.type}" maxlength="500" value="${echap(valeur ?? "")}" ${def.type === "lien" ? 'placeholder="https://…" inputmode="url"' : ""}></div>`;
}
function sousLigneTexte(v) {
  return `<div class="sous-element" style="grid-template-columns:1fr auto"><input type="text" class="champ-ligne" maxlength="300" value="${echap(v)}" aria-label="Élément" style="min-height:44px;padding:9px 12px;border-radius:10px;border:1.5px solid var(--argile-fonce);background:#fff;width:100%">
    <button type="button" class="btn danger-contour icone" data-retirer-ligne aria-label="Retirer">${I.fermer}</button></div>`;
}
function sousCarte(def, v, photos) {
  const resume = def.resume.map((k) => v?.[k]).filter(Boolean).join(" · ") || "Nouveau";
  return `<div class="sous-element" data-carte><div class="entete-sous"><span>${echap(resume)}</span>
      <button type="button" class="btn contour icone" data-monter aria-label="Monter">${I.haut}</button>
      <button type="button" class="btn danger-contour icone" data-retirer-carte aria-label="Retirer">${I.fermer}</button></div>
    ${def.champs.map((c) => champHtml(c, v?.[c.cle], "carte", photos)).join("")}</div>`;
}

function lireChamps(racine, defs, photos, erreurs) {
  // Ne lit que les champs qui appartiennent directement à « racine » (pas ceux des cartes imbriquées).
  const carteRacine = racine.matches("[data-carte]") ? racine : racine.closest("[data-carte]");
  const aMoi = (el) => el && (el.parentElement?.closest("[data-carte]") ?? null) === carteRacine;
  const premier = (sel) => [...racine.querySelectorAll(sel)].find(aMoi);
  const obj = {};
  for (const d of defs) {
    if (d.type === "photo") { const ph = photos.find((p) => p.cle === d.cle && aMoi(racine.querySelector("#" + p.id))); obj[d.cle] = ph ? ph.zone.valeur() : ""; continue; }
    if (d.type === "liste") { const z = premier(`[data-liste="${d.cle}"]`); obj[d.cle] = z ? [...z.querySelectorAll(".champ-ligne")].map((i) => i.value.trim()).filter(Boolean) : []; continue; }
    if (d.type === "cartes") {
      const z = premier(`[data-cartes="${d.cle}"]`);
      obj[d.cle] = z ? [...z.querySelector(".sous-liste").children].map((carte) => lireChamps(carte, d.champs, photos, erreurs)) : [];
      continue;
    }
    const el = premier(`[data-cle="${d.cle}"]`);
    const v = (el?.value ?? "").trim();
    if (d.obligatoire && !v) erreurs.push({ el, message: "Ce champ est obligatoire." });
    if (d.type === "lien" && v && !/^https?:\/\/\S+$/i.test(v)) erreurs.push({ el, message: "Le lien doit commencer par https://" });
    obj[d.cle] = v;
  }
  return obj;
}

function editerSection(s) {
  const photos = [];
  const valeur = cloner(E.brouillon.site[s.cle]);
  const defs = s.liste ? [{ cle: "__liste", label: s.titre, ...s.liste }] : s.champs;
  const donnees = s.liste ? { __liste: valeur } : valeur;
  fenetre({
    titre: s.titre, pleine: true,
    corps: (s.aide ? `<p class="alerte info">${echap(s.aide)}</p>` : "") + `<div data-racine>${defs.map((d) => champHtml(d, donnees[d.cle], "s", photos)).join("")}</div>`,
    boutons: [
      { texte: "Annuler", classe: "contour", action: (f) => f.close() },
      { texte: "Enregistrer", soumettre: true, action: (f) => {
        if (photos.some((p) => p.zone.enCours)) { toast("Patientez : une photo est en cours d'envoi.", "erreur"); return; }
        f.querySelectorAll(".champ.erreur").forEach((c) => { c.classList.remove("erreur"); c.querySelector(".msg-erreur")?.remove(); });
        const erreurs = [];
        const lu = lireChamps($("[data-racine]", f), defs, photos, erreurs);
        if (erreurs.length) {
          erreurs.forEach(({ el, message }) => { const c = el?.closest(".champ"); if (c) { c.classList.add("erreur"); const m = document.createElement("span"); m.className = "msg-erreur"; m.textContent = message; c.append(m); } });
          erreurs[0].el?.focus();
          return;
        }
        E.brouillon.site[s.cle] = s.liste ? lu.__liste : { ...E.brouillon.site[s.cle], ...lu };
        f.close();
        enregistrer("« " + s.titre + " » enregistré. Pensez à publier.");
      } },
    ],
    apresOuverture: (d) => {
      const brancherPhotos = () => photos.forEach((p) => { if (d.querySelector("#" + p.id) && !p.branche) { p.zone.brancher(d); p.branche = true; } });
      brancherPhotos();
      d.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.matches("[data-ajouter-ligne]")) { b.previousElementSibling.insertAdjacentHTML("beforeend", sousLigneTexte("")); b.previousElementSibling.lastElementChild.querySelector("input").focus(); }
        else if (b.matches("[data-retirer-ligne]")) b.closest(".sous-element").remove();
        else if (b.matches("[data-ajouter-carte]")) {
          const cle = b.closest("[data-cartes]").dataset.cartes;
          const def = (function trouver(liste) { for (const x of liste) { if (x.cle === cle) return x; if (x.champs) { const r = trouver(x.champs); if (r) return r; } } })(defs);
          b.previousElementSibling.insertAdjacentHTML("beforeend", sousCarte(def, {}, photos)); brancherPhotos();
          b.previousElementSibling.lastElementChild.querySelector("input,textarea")?.focus();
        }
        else if (b.matches("[data-retirer-carte]")) b.closest("[data-carte]").remove();
        else if (b.matches("[data-monter]")) { const c = b.closest("[data-carte]"); c.previousElementSibling?.before(c); }
      });
    },
  });
}

/* ---------- Publication ---------- */
function referencesPhotos(contenu) {
  const refs = new Set();
  (function parcourir(v) {
    if (typeof v === "string") { if (/^images\/uploads\//.test(v)) refs.add(v); }
    else if (Array.isArray(v)) v.forEach(parcourir);
    else if (v && typeof v === "object") Object.values(v).forEach(parcourir);
  })(contenu);
  return refs;
}

function rendreBarrePublier() {
  const zone = $("#zone-publier");
  if (!zone) return;
  const modifies = fichiersModifies();
  if (E.publication?.etat === "attente" || E.publication?.etat === "ok") {
    const ok = E.publication.etat === "ok";
    zone.innerHTML = `<div class="barre-publier ${ok ? "etat-ok" : ""}"><div class="barre-publier-int">
      <div class="texte"><strong>${ok ? "✓ Vos modifications sont en ligne" : "Publication réussie"}</strong>${ok ? "Le site public affiche la nouvelle version." : "Le site se met à jour, cela prend en général 1 à 2 minutes…"}</div>
      ${ok ? `<a class="btn or" href="${echap(LIEN_SITE)}" target="_blank" rel="noopener">Voir le site</a>` : '<div class="rouage" style="width:28px;height:28px;border-width:3px;border-color:rgba(255,255,255,.3);border-top-color:#fff" aria-hidden="true"></div>'}
      ${ok ? '<button class="btn contour" id="fermer-barre">Fermer</button>' : ""}</div></div>`;
    $("#fermer-barre")?.addEventListener("click", () => { E.publication = null; rendreBarrePublier(); });
    if (!modifies.length) return;
  }
  if (!modifies.length) { if (!E.publication) zone.innerHTML = ""; return; }
  zone.innerHTML = `<div class="barre-publier"><div class="barre-publier-int">
    <div class="texte"><strong>Modifications pas encore en ligne</strong>${modifies.map((n) => NOMS_FICHIERS[n]).join(" · ")}</div>
    <button class="btn contour" id="btn-annuler-tout">Annuler les modifications</button>
    <button class="btn or" id="btn-publier">${I.envoyer}Publier</button></div></div>`;
  $("#btn-publier").onclick = publier;
  $("#btn-annuler-tout").onclick = async () => {
    if (await confirmer({ titre: "Annuler toutes les modifications ?", texte: "Toutes les modifications non publiées seront perdues. Le site reste tel qu'il est en ligne.", bouton: "Tout annuler" })) {
      E.brouillon = cloner(E.original); E.photos = {}; sauverBrouillon(); rendre(); toast("Modifications annulées.");
    }
  };
}

async function publier() {
  const modifies = fichiersModifies();
  if (!modifies.length) return;
  const fichiers = {};
  modifies.forEach((n) => { fichiers[n] = E.brouillon[n]; });
  const refsApres = new Set(Object.keys(NOMS_FICHIERS).flatMap((n) => [...referencesPhotos(E.brouillon[n])]));
  const refsAvant = new Set(Object.keys(NOMS_FICHIERS).flatMap((n) => [...referencesPhotos(E.original[n])]));
  const photos = [...refsApres].filter((c) => E.photos[c]).map((c) => ({ chemin: c, sha: E.photos[c].sha }));
  const supprimer = [...refsAvant].filter((c) => !refsApres.has(c));
  const message = "Mise à jour : " + modifies.map((n) => NOMS_FICHIERS[n]).join(", ");
  voile("Publication en cours…");
  E.publication = { etat: "envoi" };
  try {
    const r = await api("/api/publier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base: E.base, fichiers, photos, supprimer, message }) });
    E.base = r.commit;
    E.original = cloner(E.brouillon);
    ecrireStockage(CLE_BROUILLON, null);
    E.publication = { etat: "attente", fichiers };
    fermerVoile();
    rendre();
    toast("C'est publié ! Le site sera à jour d'ici 1 à 2 minutes.", "succes", 6000);
    surveillerMiseEnLigne(fichiers);
  } catch (e) {
    fermerVoile();
    E.publication = null;
    if (e.statut === 401 || (e.statut === 403 && e.code === "non_autorise")) return;
    fenetre({ titre: "La publication n'a pas abouti", petite: true, corps: `<p class="alerte erreur">${echap(e.message)}</p><p>Vos modifications sont toujours enregistrées sur cet appareil.</p>`,
      boutons: e.code === "conflit"
        ? [{ texte: "Fermer", classe: "contour", action: (f) => f.close() }, { texte: "Recharger", action: () => { location.reload(); } }]
        : [{ texte: "Fermer", classe: "contour", action: (f) => f.close() }, { texte: "Réessayer", action: (f) => { f.close(); publier(); } }] });
  }
}

async function surveillerMiseEnLigne(fichiers) {
  const [nom, contenu] = Object.entries(fichiers)[0];
  const url = SITE.replace(/\/?$/, "/") + "data/" + nom + ".json";
  const debut = Date.now();
  while (Date.now() - debut < 6 * 60 * 1000) {
    await new Promise((ok) => setTimeout(ok, 8000));
    if (E.publication?.fichiers !== fichiers) return;
    try {
      const r = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
      if (r.ok && egal(await r.json(), contenu)) { E.publication = { etat: "ok", fichiers }; rendreBarrePublier(); return; }
    } catch { /* réessaie */ }
  }
  if (E.publication?.fichiers === fichiers) { E.publication = { etat: "ok", fichiers }; rendreBarrePublier(); }
}

demarrer();
