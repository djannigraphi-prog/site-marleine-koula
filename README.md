# Site Marleine Koula · Salon de beauté

Site statique (HTML, CSS, JavaScript) hébergé sur GitHub Pages (marleinekoula.com).

- Contenu modifiable : dossier `data/` (textes, produits, catégories, prestations, contacts).
- Photos ajoutées depuis l'administration : `images/uploads/`.
- Administration : https://marleinekoula.com/admin (connexion par e-mail et mot de passe).
  - `admin/` : interface (connexion Firebase Authentication, édition, envoi des photos, publication).
  - `worker/` : serveur sécurisé sur Cloudflare Workers. Il vérifie la connexion et la liste des e-mails
    autorisés (`ADMIN_EMAILS` dans `worker/wrangler.toml`), puis écrit dans ce dépôt avec une clé GitHub
    gardée secrète. Déployé automatiquement par `.github/workflows/deployer-serveur-admin.yml`.
  - Ajouter une personne autorisée : créer son compte dans Firebase (Authentication → Users) et ajouter
    son e-mail dans `ADMIN_EMAILS`.
  - Entretien : la clé GitHub `CONTENU_GITHUB_TOKEN` expire ; la renouveler (même réglages) et la remplacer
    dans Settings → Secrets → Actions, puis relancer l'action « Déployer le serveur d'administration ».

Pour changer d'hébergeur : télécharger ce dépôt (bouton vert « Code » → « Download ZIP »).
Les dossiers `data/` et `images/uploads/` contiennent tout votre contenu.
