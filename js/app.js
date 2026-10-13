/* Marleine Koula — script du site.
   Tout le contenu vient des fichiers du dossier data/ (modifiables depuis /admin).
   Aucun texte, prix ou produit n'est écrit en dur ici. */
(function () {
  "use strict";

  /* ---------- Outils ---------- */
  var ICONES = {
    panier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    fermer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    coeur: '<svg viewBox="0 0 24 24" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    recherche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>',
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3.5 9 4l1.2 3.6-1.9 1.5a11 11 0 0 0 6.6 6.6l1.5-1.9L20 15l.5 2.4a2 2 0 0 1-2 2.3A15.6 15.6 0 0 1 4.3 5.5a2 2 0 0 1 2.3-2Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    lieu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    horloge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>',
    feuille: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 25C7 13 14 6 26 6c0 12-7 19-19 19Z"/><path d="M7 25 18 14"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5Zm0 17.3c-1.5 0-2.9-.4-4.2-1.1l-.3-.2-2.8.8.8-2.7-.2-.3A7.8 7.8 0 1 1 12 19.8Zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.4 6.4 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-1.8-2.5V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/></svg>',
    lien: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    photo: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 7c-6 0-10 4.6-10 11 0 4 1.4 7 1.4 10.5 0 4-2.4 6.5-5.4 8.5"/><path d="M24 7c6 0 10 4.6 10 11 0 4-1.4 7-1.4 10.5 0 4 2.4 6.5 5.4 8.5"/><path d="M19.5 12.5c1.6 3.5 5.5 5.5 10 5.5"/><path d="M12 41c3-1 6-1.5 12-1.5S33 40 36 41"/></svg>'
  };
  var MECHE = '<svg class="meche" viewBox="0 0 120 18" aria-hidden="true"><path d="M2 9c10-8 18-8 28 0s18 8 28 0 18-8 28 0 18 8 32 0"/></svg>';

  function echap(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sansAccent(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function slug(t) { return sansAccent(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function chiffres(t) { return String(t || "").replace(/[^\d]/g, ""); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var stockage = {
    lire: function (cle, defaut) { try { var v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch (e) { return defaut; } },
    ecrire: function (cle, val) { try { localStorage.setItem(cle, JSON.stringify(val)); } catch (e) { /* stockage indisponible */ } }
  };

  var D = {}; // données chargées

  function devise() { return (D.site.commande && D.site.commande.devise) || "FCFA"; }
  function prix(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "Prix sur demande";
    return Number(n).toLocaleString("fr-FR").replace(/ |\s/g, " ") + " " + devise();
  }
  function prixEffectif(p) { return (p.prix_promo !== null && p.prix_promo !== undefined && p.prix_promo !== "") ? Number(p.prix_promo) : (p.prix === null || p.prix === "" ? null : Number(p.prix)); }

  /* Photo : affiche l'image si elle existe, sinon un cadre « Photo à venir ». */
  function photo(src, alt, forme, label) {
    var cls = "photo " + (forme || "arrondi");
    if (src) return '<div class="' + cls + '"><img src="' + echap(src) + '" alt="' + echap(alt || "") + '" loading="lazy"></div>';
    return '<div class="' + cls + '" role="img" aria-label="' + echap((alt ? alt + " — " : "") + "photo à venir") + '"><div class="a-venir">' + ICONES.photo + "<small>" + echap(label || "Photo à venir") + "</small></div></div>";
  }

  function lienWhatsApp(texte) {
    var n = chiffres(D.site.coordonnees.whatsapp);
    return "https://wa.me/" + n + (texte ? "?text=" + encodeURIComponent(texte) : "");
  }
  function reseauxActifs() { return (D.site.reseaux || []).filter(function (r) { return r && r.url; }); }
  function iconeReseau(nom) { var k = slug(nom); return ICONES[k] || ICONES.lien; }

  function toast(msg) {
    var t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("visible");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("visible"); }, 2200);
  }

  /* ---------- En-tête et pied de page ---------- */
  function entete(page) {
    var id = D.site.identite;
    var liens = [["index.html", "Accueil", "accueil"], ["boutique.html", "Boutique", "boutique"], ["a-propos.html", "À propos", "apropos"], ["contact.html", "Contact", "contact"]];
    $("#entete").innerHTML =
      '<header class="entete"><div class="conteneur">' +
      '<a class="marque" href="index.html"><img src="' + echap(id.logo_rond || id.logo) + '" alt="Logo ' + echap(id.nom) + '"><span>' + echap(id.nom) + "</span></a>" +
      '<nav class="nav" id="nav" aria-label="Menu principal">' +
      liens.map(function (l) { return '<a href="' + l[0] + '"' + (l[2] === page ? ' aria-current="page"' : "") + ">" + l[1] + "</a>"; }).join("") +
      "</nav>" +
      '<div class="outils-entete"><button class="icone-btn" id="ouvrir-panier" aria-label="Voir le panier">' + ICONES.panier + '<span class="pastille" id="nb-panier" hidden>0</span></button>' +
      '<button class="icone-btn burger" id="burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="nav">' + ICONES.menu + "</button></div>" +
      "</div></header>";
    $("#burger").addEventListener("click", function () {
      var n = $("#nav"); var o = n.classList.toggle("ouvert");
      this.setAttribute("aria-expanded", o); this.innerHTML = o ? ICONES.fermer : ICONES.menu;
    });
    $("#ouvrir-panier").addEventListener("click", ouvrirPanier);
  }

  function pied() {
    var id = D.site.identite, c = D.site.coordonnees;
    var res = reseauxActifs();
    $("#pied").innerHTML =
      '<footer class="pied-page"><div class="conteneur">' +
      '<div class="haut">' +
      '<img class="logo" src="' + echap(id.logo_rond || id.logo) + '" alt="Logo ' + echap(id.nom) + '">' +
      "<div><h4>Boutique</h4><p>" + echap(c.adresse_boutique) + "</p>" + (c.lien_maps ? '<a href="' + echap(c.lien_maps) + '" target="_blank" rel="noopener">Voir sur la carte</a>' : "") + "</div>" +
      "<div><h4>Entreprise</h4><p>" + echap(id.nom_legal || id.nom) + "</p><p>" + echap(c.adresse_entreprise) + "</p></div>" +
      "<div><h4>Contact</h4>" +
      (c.telephone ? '<a href="tel:' + chiffres(c.telephone).replace(/^/, "+") + '">' + echap(c.telephone) + "</a>" : "") +
      (c.whatsapp ? '<a href="' + lienWhatsApp() + '" target="_blank" rel="noopener">WhatsApp ' + echap(c.whatsapp) + "</a>" : "") +
      (c.email ? '<a href="mailto:' + echap(c.email) + '">' + echap(c.email) + "</a>" : "") +
      res.filter(function (r) { return slug(r.nom) !== "whatsapp"; }).map(function (r) { return '<a href="' + echap(r.url) + '" target="_blank" rel="noopener">' + echap(r.nom) + (r.libelle ? " · " + echap(r.libelle) : "") + "</a>"; }).join("") +
      "</div></div>" +
      '<div class="bas"><span>© ' + new Date().getFullYear() + " " + echap(id.nom) + " · " + echap(id.activite) + "</span><span>" + echap(id.slogan) + "</span></div>" +
      "</div></footer>";
  }

  /* ---------- Cartes ---------- */
  function carteCategorie(cat) {
    return '<a class="carte-categorie apparait" href="boutique.html#cat-' + slug(cat.nom) + '">' +
      photo(cat.image, cat.nom, "arche") +
      "<div><h3>" + echap(cat.nom) + "</h3>" + (cat.description ? "<p>" + echap(cat.description) + "</p>" : "") + "</div>" +
      '<span class="fleche">Voir les articles →</span></a>';
  }

  function carteProduit(p) {
    var id = slug(p.nom);
    var aime = stockage.lire("mk_jaime", []).indexOf(id) > -1;
    var promo = p.prix_promo !== null && p.prix_promo !== undefined && p.prix_promo !== "";
    var etiq = [];
    if (p.nouveaute) etiq.push('<span class="etiquette">Nouveau</span>');
    if (promo) etiq.push('<span class="etiquette vert">Promo</span>');
    var dispo = p.disponible !== false;
    return '<article class="carte-produit apparait" data-id="' + id + '">' +
      '<div style="position:relative">' + photo(p.image, p.nom, "arrondi") +
      (etiq.length ? '<div class="etiquettes">' + etiq.join("") + "</div>" : "") +
      '<button class="jaime" aria-pressed="' + aime + '" aria-label="J\'aime ' + echap(p.nom) + '" data-jaime="' + id + '">' + ICONES.coeur + "</button></div>" +
      '<div class="corps"><span class="categorie">' + echap(p.categorie) + "</span>" +
      "<h3>" + echap(p.nom) + "</h3>" +
      "<div>" + (p.description ? '<p class="desc">' + echap(p.description) + "</p>" : "") + (p.details ? '<p class="details">' + echap(p.details) + "</p>" : "") + "</div>" +
      '<div class="pied"><span class="prix">' + (promo ? "<s>" + prix(p.prix) + "</s>" : "") + prix(prixEffectif(p)) + "</span>" +
      '<button class="btn-panier" data-ajout="' + id + '"' + (dispo ? "" : " disabled") + ">" + (dispo ? ICONES.plus + "Ajouter au panier" : "Indisponible") + "</button></div>" +
      "</div></article>";
  }

  function brancherCartes(ctx) {
    $$("[data-jaime]", ctx).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-jaime"), l = stockage.lire("mk_jaime", []), i = l.indexOf(id);
        if (i > -1) l.splice(i, 1); else l.push(id);
        stockage.ecrire("mk_jaime", l); b.setAttribute("aria-pressed", i === -1);
        toast(i === -1 ? "Ajouté à vos coups de cœur" : "Retiré de vos coups de cœur");
      });
    });
    $$("[data-ajout]", ctx).forEach(function (b) {
      b.addEventListener("click", function () { ajouterAuPanier(b.getAttribute("data-ajout")); });
    });
  }

  /* ---------- Panier ---------- */
  function produitParId(id) { return D.produits.filter(function (p) { return slug(p.nom) === id; })[0]; }
  function lirePanier() { return stockage.lire("mk_panier", []).filter(function (l) { return produitParId(l.id); }); }
  function ecrirePanier(p) { stockage.ecrire("mk_panier", p); majPastille(); rendrePanier(); }
  function majPastille() {
    var n = lirePanier().reduce(function (s, l) { return s + l.qte; }, 0), b = $("#nb-panier");
    if (b) { b.textContent = n; b.hidden = n === 0; }
  }
  function ajouterAuPanier(id) {
    var p = lirePanier(), l = p.filter(function (x) { return x.id === id; })[0];
    if (l) l.qte++; else p.push({ id: id, qte: 1 });
    ecrirePanier(p); toast("« " + produitParId(id).nom + " » ajouté au panier");
  }
  function construirePanier() {
    var html =
      '<div class="voile" id="voile" hidden></div>' +
      '<aside class="tiroir" id="tiroir" aria-label="Panier" aria-hidden="true">' +
      '<div class="tete"><h2>Votre panier</h2><button class="icone-btn" id="fermer-panier" aria-label="Fermer le panier">' + ICONES.fermer + "</button></div>" +
      '<div class="liste" id="liste-panier"></div>' +
      '<div class="pied" id="pied-panier"></div></aside>';
    document.body.insertAdjacentHTML("beforeend", html);
    $("#fermer-panier").addEventListener("click", fermerPanier);
    $("#voile").addEventListener("click", fermerPanier);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { fermerPanier(); fermerReseaux(); } });
    rendrePanier(); majPastille();
  }
  function ouvrirPanier() {
    var v = $("#voile"), t = $("#tiroir"); v.hidden = false;
    requestAnimationFrame(function () { v.classList.add("visible"); t.classList.add("ouvert"); });
    t.setAttribute("aria-hidden", "false"); $("#fermer-panier").focus();
  }
  function fermerPanier() {
    var v = $("#voile"), t = $("#tiroir"); if (!t || !t.classList.contains("ouvert")) return;
    v.classList.remove("visible"); t.classList.remove("ouvert"); t.setAttribute("aria-hidden", "true");
    setTimeout(function () { v.hidden = true; }, 260);
  }
  function rendrePanier() {
    var liste = $("#liste-panier"), piedP = $("#pied-panier"); if (!liste) return;
    var p = lirePanier(), cmd = D.site.commande || {};
    if (!p.length) {
      liste.innerHTML = '<div class="vide"><p class="main">Votre panier est vide</p><p>Ajoutez un article depuis la boutique.</p></div>';
      piedP.innerHTML = '<a class="btn" href="boutique.html">Voir la boutique</a>';
      return;
    }
    var total = 0, surDemande = false;
    liste.innerHTML = p.map(function (l) {
      var pr = produitParId(l.id), u = prixEffectif(pr);
      if (u === null) surDemande = true; else total += u * l.qte;
      return '<div class="article-panier">' + photo(pr.image, pr.nom, "arrondi") +
        "<div><h3>" + echap(pr.nom) + '</h3><div class="p">' + prix(u) + "</div>" +
        '<div class="quantite"><button aria-label="Retirer un" data-moins="' + l.id + '">−</button><span>' + l.qte + '</span><button aria-label="Ajouter un" data-plus="' + l.id + '">+</button></div></div>' +
        '<button class="retirer" data-retirer="' + l.id + '">Retirer</button></div>';
    }).join("");
    piedP.innerHTML =
      '<div class="total"><span>Total</span><span>' + prix(total) + (surDemande ? " + sur demande" : "") + "</span></div>" +
      '<div class="champ"><label for="cmd-nom">Votre nom</label><input id="cmd-nom" autocomplete="name"></div>' +
      '<div class="champ"><label for="cmd-lieu">Livraison ou retrait (quartier)</label><input id="cmd-lieu" placeholder="Ex. Yopougon, retrait au salon"></div>' +
      '<p class="petite-note">' + echap(cmd.paiement || "") + " " + echap(cmd.conditions || "") + "</p>" +
      '<a class="btn whatsapp" id="commander" href="#" target="_blank" rel="noopener">' + ICONES.whatsapp + "Commander sur WhatsApp</a>" +
      '<p class="petite-note">WhatsApp s\'ouvre avec votre commande déjà écrite. Il ne reste qu\'à l\'envoyer.</p>';
    var nom = $("#cmd-nom"), lieu = $("#cmd-lieu");
    var brouillon = stockage.lire("mk_client", {}); nom.value = brouillon.nom || ""; lieu.value = brouillon.lieu || "";
    function majLien() {
      stockage.ecrire("mk_client", { nom: nom.value, lieu: lieu.value });
      var lignes = [cmd.message_whatsapp || "Bonjour, je souhaite commander :", ""];
      p.forEach(function (l) { var pr = produitParId(l.id); lignes.push("• " + l.qte + " × " + pr.nom + " — " + prix(prixEffectif(pr))); });
      lignes.push("", "Total : " + prix(total) + (surDemande ? " + articles sur demande" : ""));
      if (nom.value) lignes.push("Nom : " + nom.value);
      if (lieu.value) lignes.push("Livraison / retrait : " + lieu.value);
      $("#commander").href = lienWhatsApp(lignes.join("\n"));
    }
    nom.addEventListener("input", majLien); lieu.addEventListener("input", majLien); majLien();
    $$("[data-plus]", liste).forEach(function (b) { b.onclick = function () { changerQte(b.getAttribute("data-plus"), 1); }; });
    $$("[data-moins]", liste).forEach(function (b) { b.onclick = function () { changerQte(b.getAttribute("data-moins"), -1); }; });
    $$("[data-retirer]", liste).forEach(function (b) { b.onclick = function () { changerQte(b.getAttribute("data-retirer"), -999); }; });
  }
  function changerQte(id, d) {
    var p = lirePanier().map(function (l) { if (l.id === id) l.qte += d; return l; }).filter(function (l) { return l.qte > 0; });
    ecrirePanier(p);
  }

  /* ---------- Fenêtre réseaux (S'abonner) ---------- */
  function boutonsReseaux() {
    return '<div class="reseaux">' + reseauxActifs().map(function (r) {
      return '<a class="reseau" href="' + echap(r.url) + '" target="_blank" rel="noopener">' + iconeReseau(r.nom) + echap(r.nom) + "</a>";
    }).join("") + "</div>";
  }
  function ouvrirReseaux() {
    var a = D.site.accueil;
    document.body.insertAdjacentHTML("beforeend",
      '<div class="voile visible" id="voile-res"></div><div class="fenetre" id="fen-res" role="dialog" aria-modal="true" aria-labelledby="titre-res"><div class="boite">' +
      '<button class="icone-btn fermer" id="fermer-res" aria-label="Fermer">' + ICONES.fermer + "</button>" +
      '<h2 id="titre-res">' + echap(a.reseaux_titre) + "</h2><p>" + echap(a.reseaux_texte) + "</p>" + boutonsReseaux() + "</div></div>");
    $("#fermer-res").focus();
    $("#fermer-res").onclick = fermerReseaux; $("#fen-res").onclick = function (e) { if (e.target === this) fermerReseaux(); };
  }
  function fermerReseaux() { ["#voile-res", "#fen-res"].forEach(function (s) { var e = $(s); if (e) e.remove(); }); }

  /* ---------- Horaires ---------- */
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  function maintenantAbidjan() {
    try {
      var parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan", weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      return { jour: sansAccent(o.weekday), minutes: Number(o.hour) % 24 * 60 + Number(o.minute) };
    } catch (e) { var d = new Date(); return { jour: JOURS[d.getUTCDay()], minutes: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
  }
  function enMinutes(h) { var m = String(h || "").match(/(\d{1,2})\D?(\d{2})?/); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; }
  function affHeure(h) { var m = enMinutes(h); return m === null ? "" : Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0"); }
  function statutOuverture() {
    var n = maintenantAbidjan(), h = (D.site.coordonnees.horaires || []).filter(function (x) { return sansAccent(x.jour) === n.jour; })[0];
    if (!h || !h.ouverture) return { ouvert: false, texte: "Fermé aujourd'hui" };
    var o = enMinutes(h.ouverture), f = enMinutes(h.fermeture);
    if (n.minutes >= o && n.minutes < f) return { ouvert: true, texte: "Ouvert maintenant · jusqu'à " + affHeure(h.fermeture) };
    if (n.minutes < o) return { ouvert: false, texte: "Fermé · ouvre à " + affHeure(h.ouverture) };
    return { ouvert: false, texte: "Fermé · réouverture demain" };
  }

  /* ---------- Pages ---------- */
  function pageAccueil() {
    var s = D.site, id = s.identite, a = s.accueil, c = s.coordonnees;
    var cats = D.categories.filter(function (x) { return x.accueil !== false; });
    var prods = D.produits.filter(function (p) { return p.accueil; });
    if (!prods.length) prods = D.produits.slice(0, 4);
    prods = prods.slice(0, 8);
    $("#contenu").innerHTML =
      /* Enseigne */
      '<section class="enseigne"><div class="conteneur">' +
      '<div class="texte apparait"><span class="surtitre">' + echap(a.enseigne_surtitre) + "</span>" +
      "<h1>" + echap(id.nom) + '</h1><span class="bandeau">' + echap(id.activite) + "</span>" +
      '<p class="sous">' + echap(id.sous_titre) + '</p><p class="main">' + echap(id.slogan) + "</p>" +
      '<a class="btn or" href="boutique.html">' + echap(a.enseigne_bouton) + " →</a></div>" +
      '<div class="visuel apparait">' + photo(a.enseigne_image, id.nom + " — " + id.activite, "arche") +
      '<img class="logo-flottant" src="' + echap(id.logo_rond || id.logo) + '" alt=""></div>' +
      "</div></section>" +
      /* Catégories */
      '<section class="section"><div class="conteneur">' +
      '<div class="entete-section centre">' + MECHE + "<h2>" + echap(a.categories_titre) + '</h2><p class="intro">' + echap(a.categories_sous_titre) + "</p></div>" +
      '<div class="grille-categories">' + cats.map(carteCategorie).join("") + "</div>" +
      '<div class="actions-centre"><a class="btn contour" href="boutique.html">' + echap(a.categories_bouton) + "</a></div>" +
      "</div></section>" +
      /* Propriétaire */
      '<section class="section proprietaire"><div class="conteneur">' +
      '<div class="cadre">' + photo(a.proprietaire_photo, a.proprietaire_nom, "arche", "Votre portrait") + "</div>" +
      '<div class="texte"><span class="surtitre">' + echap(a.proprietaire_surtitre) + "</span><h2>" + echap(a.proprietaire_nom) + "</h2>" +
      '<p class="fonction">' + echap(a.proprietaire_fonction) + '</p><p class="presentation">' + echap(a.proprietaire_presentation) + "</p>" +
      "<blockquote>" + echap(id.slogan) + "</blockquote>" +
      '<a class="btn" href="boutique.html#nouveautes">' + echap(a.proprietaire_bouton) + "</a></div>" +
      "</div></section>" +
      /* Produits */
      '<section class="section"><div class="conteneur">' +
      '<div class="entete-section">' + MECHE + "<h2>" + echap(a.produits_titre) + '</h2><p class="intro">' + echap(a.produits_sous_titre) + "</p></div>" +
      '<div class="grille-produits">' + prods.map(carteProduit).join("") + "</div>" +
      '<div class="actions-centre"><a class="btn contour" href="boutique.html">' + echap(a.produits_bouton) + "</a></div>" +
      "</div></section>" +
      /* Contacts */
      '<section class="section contacts"><div class="conteneur">' +
      '<div class="entete-section">' + MECHE + "<h2>" + echap(a.contacts_titre) + '</h2><p class="intro">' + echap(a.contacts_sous_titre) + "</p></div>" +
      '<div class="grille-contacts">' +
      (c.whatsapp ? '<a class="carte-contact" href="' + lienWhatsApp() + '" target="_blank" rel="noopener"><span class="ico">' + ICONES.whatsapp + "</span><strong>WhatsApp Business</strong><span>" + echap(c.whatsapp) + "</span></a>" : "") +
      (c.email ? '<a class="carte-contact" href="mailto:' + echap(c.email) + '"><span class="ico">' + ICONES.mail + "</span><strong>E-mail</strong><span>" + echap(c.email) + "</span></a>" : "") +
      (c.telephone ? '<a class="carte-contact" href="tel:+' + chiffres(c.telephone) + '"><span class="ico">' + ICONES.tel + "</span><strong>Téléphone</strong><span>" + echap(c.telephone) + "</span></a>" : "") +
      "</div>" +
      '<div class="abonnement"><div><h3>' + echap(a.reseaux_titre) + "</h3><p>" + echap(a.reseaux_texte) + "</p></div>" + boutonsReseaux() + "</div>" +
      "</div></section>";
    brancherCartes($("#contenu"));
  }

  function pageBoutique() {
    var b = D.site.boutique, cmd = D.site.commande || {};
    var filtres = [{ id: "tous", nom: "Tous les produits" }, { id: "nouveautes", nom: "Nouveautés" }]
      .concat(D.categories.map(function (c) { return { id: "cat-" + slug(c.nom), nom: c.nom, cat: c.nom }; }));
    $("#contenu").innerHTML =
      '<section class="tete-page"><div class="conteneur">' + MECHE + "<h1>" + echap(b.titre) + '</h1><p class="intro">' + echap(b.sous_titre) + "</p></div></section>" +
      '<section class="section" style="padding-top:0"><div class="conteneur">' +
      '<div class="barre-boutique"><label class="recherche" for="recherche"><span class="sr" hidden>Rechercher</span>' + ICONES.recherche +
      '<input id="recherche" type="search" placeholder="' + echap(b.recherche_placeholder) + '" aria-label="Rechercher un produit"></label>' +
      '<div class="boutons-boutique"><button class="btn contour" id="btn-abonner">' + echap(b.bouton_abonner) + '</button><button class="btn" id="btn-panier-boutique">' + ICONES.panier + "Panier</button></div></div>" +
      '<div class="onglets" role="tablist" aria-label="Catégories">' + filtres.map(function (f) { return '<button class="onglet" role="tab" aria-selected="false" data-filtre="' + f.id + '">' + echap(f.nom) + "</button>"; }).join("") + "</div>" +
      '<div class="info-paiement">' + ICONES.info + "<span>" + echap(cmd.paiement || "") + " " + echap(cmd.conditions || "") + "</span></div>" +
      '<p class="compteur" id="compteur" aria-live="polite"></p>' +
      '<div class="grille-produits" id="grille"></div>' +
      '<div class="vide" id="vide" hidden><p class="main">Rien ici pour l\'instant</p><p>' + echap(b.aucun_resultat) + "</p></div>" +
      "</div></section>";
    var actif = "tous";
    var h = (location.hash || "").replace("#", "");
    if (filtres.some(function (f) { return f.id === h; })) actif = h;
    function afficher() {
      var q = sansAccent($("#recherche").value.trim()), f = filtres.filter(function (x) { return x.id === actif; })[0];
      var liste = D.produits.filter(function (p) {
        if (actif === "nouveautes" && !p.nouveaute) return false;
        if (f.cat && p.categorie !== f.cat) return false;
        if (q && sansAccent([p.nom, p.description, p.details, p.categorie].join(" ")).indexOf(q) === -1) return false;
        return true;
      });
      $$(".onglet").forEach(function (o) { o.setAttribute("aria-selected", o.getAttribute("data-filtre") === actif); });
      $("#grille").innerHTML = liste.map(carteProduit).join("");
      $("#vide").hidden = liste.length > 0;
      $("#compteur").textContent = liste.length + (liste.length > 1 ? " articles" : " article");
      brancherCartes($("#grille"));
    }
    $$(".onglet").forEach(function (o) {
      o.addEventListener("click", function () {
        actif = o.getAttribute("data-filtre");
        try { history.replaceState(null, "", actif === "tous" ? location.pathname : "#" + actif); } catch (e) { /* ignoré */ }
        afficher();
      });
    });
    $("#recherche").addEventListener("input", afficher);
    $("#btn-abonner").addEventListener("click", ouvrirReseaux);
    $("#btn-panier-boutique").addEventListener("click", ouvrirPanier);
    window.addEventListener("hashchange", function () { var x = location.hash.replace("#", ""); if (filtres.some(function (f) { return f.id === x; })) { actif = x; afficher(); } });
    afficher();
  }

  function pageAPropos() {
    var p = D.site.a_propos;
    $("#contenu").innerHTML =
      '<section class="tete-page apropos-intro"><div class="conteneur">' +
      '<div class="texte">' + MECHE + "<h1>" + echap(p.titre) + '</h1><p class="intro">' + echap(p.introduction) + '</p><p class="main">' + echap(D.site.identite.slogan) + "</p></div>" +
      photo(p.image, "Le salon " + D.site.identite.nom, "arche", "Photo du salon") +
      "</div></section>" +
      '<section class="section"><div class="conteneur">' +
      '<div class="entete-section"><span class="surtitre">' + echap(D.site.identite.creation || "") + "</span><h2>" + echap(p.savoir_faire_titre) + "</h2></div>" +
      '<ul class="savoir-faire">' + (p.savoir_faire || []).map(function (x) { return "<li>" + echap(x) + "</li>"; }).join("") + "</ul>" +
      "</div></section>" +
      '<section class="section" style="padding-top:0"><div class="conteneur">' +
      '<div class="entete-section centre">' + MECHE + "<h2>" + echap(p.distinctions_titre) + "</h2></div>" +
      '<div class="grille-distinctions">' + (p.distinctions || []).map(function (d) { return '<div class="distinction apparait"><span class="feuille">' + ICONES.feuille + "</span><h3>" + echap(d.titre) + "</h3><p>" + echap(d.texte) + "</p></div>"; }).join("") + "</div>" +
      "</div></section>" +
      '<section class="section" style="padding-top:0"><div class="conteneur">' +
      '<div class="entete-section">' + MECHE + "<h2>" + echap(p.prestations_titre) + '</h2><p class="intro">' + echap(D.site.coordonnees.rendez_vous) + "</p></div>" +
      '<div class="tarifs-boite"><table class="tarifs"><thead><tr><th>Prestation</th><th>Détail</th><th>Durée</th><th class="num">Prix</th></tr></thead><tbody>' +
      D.prestations.map(function (x) { return "<tr><td>" + echap(x.nom) + "</td><td>" + echap(x.detail) + "</td><td>" + echap(x.duree) + '</td><td class="num">' + prix(x.prix) + "</td></tr>"; }).join("") +
      '</tbody></table></div><p class="note">' + echap(p.prestations_note) + "</p>" +
      '<div class="actions-centre" style="justify-content:flex-start"><a class="btn whatsapp" href="' + lienWhatsApp("Bonjour Marleine Koula, je souhaite prendre rendez-vous.") + '" target="_blank" rel="noopener">' + ICONES.whatsapp + "Prendre rendez-vous</a></div>" +
      "</div></section>" +
      '<section class="section communaute"><div class="conteneur">' + MECHE +
      "<h2>" + echap(p.communaute_titre) + "</h2><p>" + echap(p.communaute_texte) + "</p>" + boutonsReseaux() + "</div></section>";
  }

  function pageContact() {
    var c = D.site.coordonnees, ct = D.site.contact, st = statutOuverture(), auj = maintenantAbidjan().jour;
    $("#contenu").innerHTML =
      '<section class="tete-page"><div class="conteneur">' + MECHE + "<h1>" + echap(ct.titre) + '</h1><p class="intro">' + echap(ct.introduction) + "</p></div></section>" +
      '<section class="section" style="padding-top:0"><div class="conteneur grille-contact-page">' +
      '<div class="bloc"><h2>Nous joindre</h2>' +
      (c.telephone ? '<div class="ligne-contact"><span class="ico">' + ICONES.tel + '</span><div><small>Téléphone · rendez-vous</small><a href="tel:+' + chiffres(c.telephone) + '">' + echap(c.telephone) + "</a></div></div>" : "") +
      (c.whatsapp ? '<div class="ligne-contact"><span class="ico">' + ICONES.whatsapp + '</span><div><small>WhatsApp Business</small><a href="' + lienWhatsApp() + '" target="_blank" rel="noopener">' + echap(c.whatsapp) + "</a></div></div>" : "") +
      (c.email ? '<div class="ligne-contact"><span class="ico">' + ICONES.mail + '</span><div><small>E-mail</small><a href="mailto:' + echap(c.email) + '">' + echap(c.email) + "</a></div></div>" : "") +
      '<div class="ligne-contact"><span class="ico">' + ICONES.lieu + '</span><div><small>Boutique</small><span>' + echap(c.adresse_boutique) + "</span>" + (c.lien_maps ? '<br><a href="' + echap(c.lien_maps) + '" target="_blank" rel="noopener">Ouvrir dans Google Maps →</a>' : "") + "</div></div>" +
      (c.adresse_entreprise && c.adresse_entreprise !== c.adresse_boutique ? '<div class="ligne-contact"><span class="ico">' + ICONES.lieu + '</span><div><small>Entreprise</small><span>' + echap(c.adresse_entreprise) + "</span></div></div>" : "") +
      '<a class="btn whatsapp" href="' + lienWhatsApp("Bonjour Marleine Koula,") + '" target="_blank" rel="noopener">' + ICONES.whatsapp + "Écrire sur WhatsApp</a>" +
      "</div>" +
      '<div class="bloc"><h2>Horaires d\'ouverture</h2><span class="statut' + (st.ouvert ? " ouvert" : "") + '">' + echap(st.texte) + "</span>" +
      '<table class="horaires"><tbody>' + (c.horaires || []).map(function (h) {
        return '<tr class="' + (sansAccent(h.jour) === auj ? "aujourdhui" : "") + '"><td>' + echap(h.jour) + "</td><td>" + (h.ouverture ? affHeure(h.ouverture) + " – " + affHeure(h.fermeture) : "Fermé") + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<p class="petite-note">Heure d\'Abidjan.</p>' +
      "<h2 style=\"margin-top:10px\">Réseaux sociaux</h2>" +
      '<div class="reseaux reseaux-clair">' + reseauxActifs().map(function (r) { return '<a class="btn contour" href="' + echap(r.url) + '" target="_blank" rel="noopener">' + iconeReseau(r.nom) + echap(r.nom) + (r.libelle && slug(r.nom) !== "whatsapp" ? " · " + echap(r.libelle) : "") + "</a>"; }).join("") + "</div>" +
      "</div></div></section>";
  }

  /* ---------- Démarrage ---------- */
  function charger(f) { return fetch("data/" + f + ".json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(f); return r.json(); }); }

  document.addEventListener("DOMContentLoaded", function () {
    var porteur = document.querySelector("[data-page]"), page = (porteur && porteur.getAttribute("data-page")) || "accueil";
    Promise.all([charger("site"), charger("categories"), charger("produits"), charger("prestations")])
      .then(function (r) {
        D.site = r[0]; D.categories = r[1].categories || []; D.produits = r[2].produits || []; D.prestations = r[3].prestations || [];
        entete(page); pied(); construirePanier();
        ({ accueil: pageAccueil, boutique: pageBoutique, apropos: pageAPropos, contact: pageContact })[page]();
      })
      .catch(function () {
        $("#contenu").innerHTML = '<div class="conteneur section"><h2>Le contenu n\'a pas pu être chargé</h2><p class="intro">Ouvrez le site depuis son adresse en ligne (Netlify) plutôt qu\'en double-cliquant sur le fichier : le navigateur bloque la lecture des fichiers de données en local.</p></div>';
      });
  });
})();
