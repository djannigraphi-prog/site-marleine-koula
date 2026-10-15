/* Réglages publics de l'administration (aucune donnée secrète ici).
   La clé « apiKey » de Firebase n'est pas un secret : elle identifie seulement le projet.
   La sécurité repose sur le mot de passe, la liste des e-mails autorisés et le serveur. */
window.MK_ADMIN = {
  firebase: {
    apiKey: "",          // à remplir après la création du projet Firebase
    authDomain: "",      // ex. marleinekoula-admin.firebaseapp.com
    projectId: "",       // ex. marleinekoula-admin
  },
  api: "",               // adresse du serveur Cloudflare, ex. https://marleinekoula-admin.xxxx.workers.dev
  site: "/",             // adresse du site public (photos et vérification de la publication)
};
