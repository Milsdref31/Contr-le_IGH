/* ===== PONT NATIF (APK Android via Capacitor) =====
   Ouverte dans un navigateur d'ordinateur (pour test), l'appli n'utilise pas ce fichier : NATIVE = false.
   Dans l'APK, il remplace ce que la vue web Android ne sait pas faire :
   - enregistrer un fichier (PDF / CSV) dans Documents/Ronde LA TOUR/AAAA-MM-JJ/
   - ouvrir le menu de partage Android (mail, Teams, Drive…)
   - gérer le bouton « retour » du téléphone                                   */
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const Native = (() => {
  if (!NATIVE) return null;
  try {
  /* Dans l'APK, Android injecte chaque plugin dans window.Capacitor.Plugins.
     (Capacitor.registerPlugin n'existe que si la bibliothèque @capacitor/core est chargée :
     ce n'est pas le cas ici, l'appli n'ayant pas d'étape de compilation.) */
  const plugin = nom => {
    const p = (Capacitor.Plugins && Capacitor.Plugins[nom]) || (Capacitor.registerPlugin && Capacitor.registerPlugin(nom));
    if (!p) throw new Error('Plugin natif absent : ' + nom);
    return p;
  };
  const Filesystem = plugin('Filesystem');
  const Share = plugin('Share');
  const App = plugin('App');
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

  /* Rappels hebdomadaires (notifications locales, sans serveur).
     list = [{ at: Date, body: texte }]. Remplace tous les rappels déjà programmés. */
  const LN = plugin('LocalNotifications');
  const ID0 = 1000;   // plage d'identifiants réservée aux rappels : 1000 à 1099
  async function planReminders(list) {
    try {
      let p = await LN.checkPermissions();
      if (p.display !== 'granted') p = await LN.requestPermissions();
      if (p.display !== 'granted') return false;
      const pending = (await LN.getPending()).notifications.filter(x => x.id >= ID0 && x.id < ID0 + 100);
      if (pending.length) await LN.cancel({ notifications: pending.map(x => ({ id: x.id })) });
      if (list.length) {
        await LN.schedule({
          notifications: list.slice(0, 100).map((x, i) => ({
            id: ID0 + i,
            title: 'Ronde de sécurité LA TOUR',
            body: x.body,
            schedule: { at: x.at, allowWhileIdle: true },
            isExactNotification: false,   // « vers 8 h 30 » : pas besoin d'alarme exacte
          })),
        });
      }
      return true;
    } catch (e) {
      console.warn('Rappels non programmés', e);
      return false;
    }
  }

  return { saveAndShare, toast, planReminders };
  } catch (e) {
    /* Ne jamais bloquer l'appli : sans pont natif, les exports affichent un message clair. */
    console.error('Pont natif indisponible', e);
    window.NATIVE_ERROR = String(e && e.message || e);
    return null;
  }
})();
