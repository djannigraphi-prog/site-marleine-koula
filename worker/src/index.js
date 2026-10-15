/* Point d'entrée Cloudflare Worker (production). */
import { creerGestionnaire } from "./core.js";
import { verifierJetonFirebase } from "./jeton-firebase.js";

const gerer = creerGestionnaire({ verifierJeton: (jeton, env) => verifierJetonFirebase(jeton, env) });

export default {
  fetch(req, env) { return gerer(req, env); },
};
