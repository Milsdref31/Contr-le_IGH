/* ===== PONT NATIF (APK Android via Capacitor) =====
   Dans un navigateur (Netlify), ce fichier ne fait rien : NATIVE = false
   et l'appli garde son comportement web habituel.
   Dans l'APK, il remplace ce que la vue web Android ne sait pas faire :
   - enregistrer un fichier (PDF / CSV) dans Documents/Ronde LA TOUR/AAAA-MM-JJ/
   - ouvrir le menu de partage Android (mail, Teams, Drive…)
   - gérer le bouton « retour » du téléphone                                   */
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const Native = (() => {
  if (!NATIVE) return null;
  const Filesystem = Capacitor.registerPlugin('Filesystem');
  const Share = Capacitor.registerPlugin('Share');
  const App = Capacitor.registerPlugin('App');
  const DOSSIER = 'Ronde LA TOUR';

  const toBase64 = blob => new Promise((ok, ko) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.onerror = () => ko(fr.error);
    fr.readAsDataURL(blob);
  });

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:20;' +
      'background:#14212b;color:#fff;padding:12px 14px;border-radius:10px;font-size:14px;box-shadow:0 4px 16px #0006';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  /* Écrit le fichier. Ordre d'essai :
     1. Documents/Ronde LA TOUR/<date>/<nom>        (visible dans l'appli Fichiers)
     2. même dossier, nom suffixé de l'heure          (si un fichier du même nom est verrouillé)
     3. cache de l'appli                              (dernier recours : le partage fonctionne quand même) */
  async function write(data, sousDossier, nom) {
    const h = new Date(), suffixe = '_' + String(h.getHours()).padStart(2, '0') + 'h' + String(h.getMinutes()).padStart(2, '0');
    const nom2 = nom.replace(/(\.[a-z]+)$/i, suffixe + '$1');
    const essais = [
      { directory: 'DOCUMENTS', path: DOSSIER + '/' + sousDossier + '/' + nom, lieu: 'Documents/' + DOSSIER + '/' + sousDossier },
      { directory: 'DOCUMENTS', path: DOSSIER + '/' + sousDossier + '/' + nom2, lieu: 'Documents/' + DOSSIER + '/' + sousDossier },
      { directory: 'CACHE', path: nom, lieu: null }
    ];
    let derniere;
    for (const e of essais) {
      try {
        const r = await Filesystem.writeFile({ path: e.path, data, directory: e.directory, recursive: true });
        return { uri: r.uri, lieu: e.lieu };
      } catch (err) { derniere = err; }
    }
    throw derniere;
  }

  /* Enregistre puis propose le partage. sousDossier = date AAAA-MM-JJ de la ronde. */
  async function saveAndShare(blob, nom, sousDossier) {
    let res;
    try {
      res = await write(await toBase64(blob), sousDossier, nom);
    } catch (e) {
      alert('Impossible d’enregistrer le fichier : ' + (e && e.message || e));
      return;
    }
    if (res.lieu) toast('Enregistré dans ' + res.lieu);
    try {
      await Share.share({ title: nom, files: [res.uri], dialogTitle: 'Envoyer ' + nom });
    } catch (e) {
      /* Partage annulé par l'utilisateur : rien à faire, le fichier est déjà enregistré. */
    }
  }

  /* Bouton retour Android : délégué à window.onBack() défini dans index.html.
     onBack() renvoie false quand on est sur l'accueil → l'appli se ferme. */
  App.addListener('backButton', () => {
    if (!(window.onBack && window.onBack())) App.exitApp();
  });

  return { saveAndShare, toast };
})();
