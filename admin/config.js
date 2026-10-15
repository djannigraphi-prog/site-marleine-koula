/* Réglages publics de l'administration (aucune donnée secrète ici).
   « api » : adresse du serveur d'administration (Cloudflare). Elle est écrite automatiquement
   par le déploiement (.github/workflows/deployer-serveur-admin.yml).
   Les réglages de connexion Firebase (publics) sont fournis par ce serveur (/api/config). */
window.MK_ADMIN = {
  api: "",
  site: "/",
};
