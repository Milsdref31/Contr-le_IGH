/* =====================================================================
   CONTRÔLE IGH — logique de l'application
   Données : stockées sur le téléphone (localStorage), aucun serveur.
   Dépend de : catalogue.js (points), pdf.js (rapport), native.js (APK).
   ===================================================================== */

/* ---------- Données ---------- */
const KEY = 'ronde_latour_v3';        // v3 : une ronde par entrée. Les données v2 restent sous leur ancienne clé.
let DB;
try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* stockage illisible : on repart à vide */ }
DB = DB || { rondes: [], cur: null, agent: '' };
/* Migration : avant le 07/10/2026, la centrale SSI était une étape séparée (clé « e1-centrale|13.1 »).
   Ses réponses sont rattachées au niveau qui porte désormais la SSI (voir NIVEAU_SSI). */
DB.rondes.forEach(r => Object.keys(r.r).forEach(k => {
  const m = k.match(/^e(\d)-centrale\|(.+)$/);
  if (m && NIVEAU_SSI[m[1]]) { r.r['e' + m[1] + '-' + NIVEAU_SSI[m[1]] + '|' + m[2]] = r.r[k]; delete r.r[k]; }
}));

/* Enregistrement automatique : appelé à chaque réponse, saisie, changement d'écran
   et quand l'appli passe en arrière-plan. Rien n'est jamais à « enregistrer » à la main. */
let lastSave = null;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); lastSave = new Date(); showSaved(); }
  catch (e) { alert('Mémoire du téléphone pleine. Exportez puis supprimez d’anciennes rondes.'); }
}
function showSaved() {
  const el = document.getElementById('sv');
  if (el && lastSave) el.textContent = 'Enregistré ' + lastSave.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const cur = () => DB.rondes.find(r => r.id === DB.cur);
const byId = id => DB.rondes.find(r => r.id == id);
const enCours = t => DB.rondes.find(r => r.type === t && r.statut === 'en cours');
const closes = () => DB.rondes.filter(r => r.statut === 'clôturée');
const now = () => new Date().toISOString();

/* ---------- Outils d'affichage ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const fd = i => new Date(i).toLocaleDateString('fr-FR');
const ft = i => new Date(i).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fdl = i => new Date(i).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
function dur(r) {
  const m = Math.round((new Date(r.fin) - new Date(r.debut)) / 60000);
  return m >= 60 ? Math.floor(m / 60) + ' h ' + p2(m % 60) : m + ' min';
}
const plural = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);

/* Comptage des réponses d'une ronde (ou d'une liste de stations). */
function cnt(r, stations) {
  let c = 0, n = 0, t = 0;
  (stations || stationsDe(r)).forEach(s => s.pts.forEach(p => {
    t++;
    const x = r.r[p.k];
    if (x) x.v === 'C' ? c++ : n++;
  }));
  return { t, c, n, rest: t - c - n, done: c + n };
}

/* Toutes les anomalies (non-conformités) des rondes clôturées. */
function anomalies() {
  return closes().flatMap(r => stationsDe(r).flatMap(s => s.pts
    .filter(p => r.r[p.k] && r.r[p.k].v === 'NC')
    .map(p => ({ r, s, p, x: r.r[p.k] }))));
}
const ouverte = a => a.x.suivi !== 'Levée';
const archivee = a => !!a.x.archive;

/* ---------- Contrôles de la semaine (lundi 00:00 à dimanche 23:59) ---------- */
function lundi(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
/* Ronde clôturée cette semaine pour ce type (la plus récente), sinon undefined. */
const faiteSemaine = (t, ref) => closes().filter(r => r.type === t && new Date(r.debut) >= lundi(ref || new Date())).pop();
const resteSemaine = ref => Object.keys(RONDES).filter(t => !faiteSemaine(t, ref));

/* Calcule les rappels des 4 prochaines semaines : jours ouvrés à 8 h 30,
   sauf pour la semaine en cours si les 3 rondes sont déjà clôturées. */
function planRappels() {
  const list = [], maintenant = new Date(), reste = resteSemaine();
  const d = new Date(maintenant); d.setHours(RAPPEL.heure, RAPPEL.minute, 0, 0);
  for (let i = 0; i < 28; i++, d.setDate(d.getDate() + 1)) {
    if (!RAPPEL.jours.includes(d.getDay()) || d <= maintenant) continue;
    const memeSemaine = lundi(d).getTime() === lundi(maintenant).getTime();
    const aFaire = memeSemaine ? reste : Object.keys(RONDES);
    if (!aFaire.length) continue;
    list.push({ at: new Date(d), body: (aFaire.length === 3 ? 'Les 3 contrôles' : plural(aFaire.length, 'contrôle')) +
      ' de la semaine à faire : ' + aFaire.map(t => RONDES[t].nom).join(', ') + '.' });
  }
  return list;
}
function majRappels() {
  if (!(NATIVE && Native)) return;
  try { Native.planReminders(planRappels()); }        // asynchrone : ne bloque jamais l'écran
  catch (e) { console.warn('Rappels non programmés', e); }
}
/* Dans l'APK, si le pont natif n'a pas pu démarrer, on le dit au lieu de ne rien faire. */
function natifIndispo() {
  alert('Export impossible : module Android indisponible (' + (window.NATIVE_ERROR || 'inconnu') + ').');
}

/* ---------- Fichiers exportés : AAAA-MM-JJ_Ronde_<BATIMENT>_Entree-1.pdf ---------- */
const SLUG = { e1: 'Entree-1', e3: 'Entree-3', g: 'General' };
const day = r => { const t = new Date(r.debut); return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()); };
const fname = r => day(r) + '_Ronde_' + BATIMENT.trim().replace(/\s+/g, '-') + '_' + SLUG[r.type];
/* Texte utilisable dans un nom de fichier : sans accent ni espace (ex. « Portes coupe-feu » -> « Portes-coupe-feu »). */
const slug = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9+]+/g, '-').replace(/^-+|-+$/g, '');
const jour = iso => { const t = new Date(iso); return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()); };
/* Nom d'une photo d'anomalie : date_entrée_étage_équipement.jpg
   ex. 2026-10-07_Entree-1_R+12_Portes-coupe-feu-4.1.jpg (pour la ronde Général, l'« étage » est la zone). */
function nomPhoto(r, s, p, x) {
  const etage = r.type === 'g' ? slug(s.titre) : slug(s.court);
  return jour(x.t) + '_' + SLUG[r.type] + '_' + etage + '_' + slug(p.fam) + '-' + p.id + '.jpg';
}
const texteComs = x => (x.coms || []).map(c => fd(c.t) + ' ' + ft(c.t) + ' ' + c.auteur + ' : ' + c.txt).join(' | ');

/* Logo facultatif du PDF : déposer un fichier logo.png à côté de index.html */
let LOGO = null;
fetch('logo.png').then(x => (x.ok ? x.blob() : null)).then(b => {
  if (!b) return;
  const fr = new FileReader();
  fr.onload = () => { LOGO = fr.result; };
  fr.readAsDataURL(b);
}).catch(() => {});

async function exportPDF(r) {
  if (!window.jspdf) { alert('Module PDF non chargé : ouvrez l’application une fois avec du réseau.'); return; }
  const doc = makePDF(r, stationsDe(r), { [r.type]: RONDES[r.type].nom },
    { fd, ft, dur, cnt, logo: LOGO, label: RONDES[r.type].nom });
  const name = fname(r) + '.pdf';
  if (NATIVE) return Native ? Native.saveAndShare(doc.output('blob'), name, day(r)) : natifIndispo();
  doc.save(name);   // hors APK (test sur ordinateur) : simple téléchargement
}

/* Export CSV : une ligne par point. Les photos d'anomalies sont jointes au même envoi,
   renommées date_entrée_étage_équipement.jpg ; la colonne « Fichier photo » donne ce nom. */
async function exportCSV(r) {
  const L = [['Date', 'Heure', 'Agent', 'Bâtiment', 'Ronde', 'Entrée', 'Niveau / zone', 'Point', 'Famille', 'Libellé',
    'Résultat', 'Lieu anomalie', 'Observation', 'Fichier photo', 'Suivi', 'Commentaires de suivi', 'Archivée le', 'Mode']];
  const photos = [];
  stationsDe(r).forEach(s => s.pts.forEach(p => {
    const x = r.r[p.k];
    let fichier = '';
    if (x && x.ph) { fichier = nomPhoto(r, s, p, x); photos.push({ nom: fichier, base64: x.ph.split(',')[1], dataUrl: x.ph }); }
    L.push([x ? fd(x.t) : '', x ? ft(x.t) : '', r.agent, BATIMENT, RONDES[r.type].nom, s.ent || (x && x.ent) || '', s.titre,
      p.id, p.fam, p.lib, x ? (x.v === 'C' ? 'Conforme' : 'Non conforme') : 'MANQUANT',
      (x && x.lieu) || '', (x && x.com) || '', fichier, (x && x.suivi) || '', x ? texteComs(x) : '',
      x && x.archive ? fd(x.archive.t) : '', x ? (x.bloc ? 'en bloc' : 'unitaire') : '']);
  }));
  const txt = '\ufeff' + L.map(l => l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const b = new Blob([txt], { type: 'text/csv' });
  const nomCsv = fname(r) + '.csv';
  if (NATIVE) {
    if (!Native) return natifIndispo();
    return Native.saveAndShareMany([{ nom: nomCsv, blob: b }, ...photos], day(r),
      photos.length ? nomCsv + ' + ' + plural(photos.length, 'photo') : nomCsv);
  }
  telecharger(URL.createObjectURL(b), nomCsv);   // hors APK (test sur ordinateur) : téléchargements
  photos.forEach(f => telecharger(f.dataUrl, f.nom));
}
function telecharger(href, nom) {
  const a = document.createElement('a');
  a.href = href; a.download = nom; a.click();
}

/* ---------- Sauvegarde / restauration de toutes les données ---------- */
function sauvegarde() {
  return JSON.stringify({ app: 'controle-igh', format: 1, creee: now(), batiment: BATIMENT, data: { ...DB, ui: null } });
}
const nomSauvegarde = () => jour(now()) + '_Sauvegarde_Controle-IGH.json';
async function exporterSauvegarde(partager = true) {
  const b = new Blob([sauvegarde()], { type: 'application/json' }), nom = nomSauvegarde();
  if (NATIVE) return Native ? Native.saveAndShareMany([{ nom, blob: b }], 'Sauvegardes', nom, partager) : natifIndispo();
  telecharger(URL.createObjectURL(b), nom);
}
function restaurer(texte) {
  let o;
  try { o = JSON.parse(texte); } catch (e) { alert('Fichier illisible : ce n’est pas une sauvegarde de l’application.'); return; }
  if (!o || o.app !== 'controle-igh' || !o.data || !Array.isArray(o.data.rondes)) {
    alert('Ce fichier n’est pas une sauvegarde de l’application Contrôle IGH.'); return;
  }
  const n = o.data.rondes.length;
  if (!confirm('Restaurer la sauvegarde du ' + fd(o.creee) + ' à ' + ft(o.creee) + ' (' + plural(n, 'ronde') + ') ?\n\n'
    + 'Les données actuelles de l’application seront REMPLACÉES.')) return;
  try { localStorage.setItem(KEY + '_avant_restauration', JSON.stringify(DB)); } catch (e) { /* place insuffisante : on continue */ }
  DB = o.data;
  DB.ui = null;
  save();
  V = { s: 'home' }; M = null; render(); majRappels();
  alert('Sauvegarde restaurée : ' + plural(n, 'ronde') + '.');
}

/* ---------- Mise à jour depuis l'application (APK) ---------- */
let MAJ = null;   // résultat de la dernière recherche : { installe, derniere, dispo }
async function chercherMaj() {
  const info = NATIVE && Native ? await Native.appInfo() : { version: 'navigateur', build: '0' };
  const rep = await fetch('https://api.github.com/repos/' + MISE_A_JOUR.depot + '/releases/latest',
    { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (!rep.ok) throw new Error('serveur de mise à jour injoignable (HTTP ' + rep.status + ')');
  const rel = await rep.json(), m = /v\d+\.\d+\.(\d+)/.exec(rel.tag_name || ''), apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
  const derniere = { tag: rel.tag_name, build: m ? +m[1] : 0, url: apk && apk.browser_download_url, test: /-TEST/i.test(rel.tag_name || ''), date: rel.published_at };
  MAJ = { installe: info, derniere, dispo: !!(derniere.url && derniere.build > +info.build) };
  return MAJ;
}
async function installerMaj() {
  if (!(MAJ && MAJ.dispo)) return;
  if (!(NATIVE && Native && Native.Updater)) { alert('La mise à jour se fait depuis l’application installée sur le téléphone.'); return; }
  if (MAJ.derniere.test && !confirm('Cette version est une version de TEST, signée avec une clé différente : Android risque de refuser '
    + 'de l’installer par-dessus. Dans ce cas, il faudra désinstaller puis réinstaller (après restauration de la sauvegarde).\n\nContinuer ?')) return;
  const ok = (await Native.Updater.canInstall()).allowed;
  if (!ok) {
    alert('Android doit autoriser cette application à installer des mises à jour.\n\nActivez « Autoriser cette source » dans l’écran qui va s’ouvrir, '
      + 'revenez dans l’application puis appuyez à nouveau sur « Installer ».');
    await Native.Updater.openInstallSettings();
    return;
  }
  await exporterSauvegarde(false);   // sauvegarde de sécurité avant la mise à jour (Documents/Contrôle IGH/Sauvegardes)
  Native.toast('Téléchargement de la version ' + MAJ.derniere.tag + '…');
  try { await Native.Updater.downloadAndInstall({ url: MAJ.derniere.url }); }
  catch (e) { alert((e && e.message) || String(e)); }
}
/* Recherche discrète au démarrage (une fois par jour, sans message en cas d'échec). */
function majAuDemarrage() {
  if (!(NATIVE && Native)) return;
  const auj = jour(now());
  if (DB.majVerif === auj) return;
  chercherMaj().then(() => {
    DB.majVerif = auj; save();
    if (MAJ.dispo && V.s === 'home' && !M) render(true);
  }).catch(() => {});
}

/* ---------- Navigation ----------
   V = écran courant, M = fenêtre ouverte (anomalie, clôture, photo), F = filtres */
let V = { s: 'home' }, M = null;
const F = { hist: 'all', anomStatut: 'open', anomRonde: 'all' };
const SIG = { traits: 0 };   // signature en cours de tracé

const topBar = (back, titre, sous, extra) => `<div class="top">
  ${back ? `<button class="back" data-a="go" data-s="${back}" aria-label="Retour">‹ Retour</button>` : '<span></span>'}
  <div><div class="t">${titre}</div>${sous ? `<div class="s">${sous}</div>` : ''}</div>
  <div>${extra || ''}</div></div>`;
const progress = c => `<div class="prog"><i style="width:${Math.round(100 * c.done / c.t)}%"></i></div>`;

/* ---------- Écran : accueil ---------- */
function home() {
  const ouvertes = anomalies().filter(ouverte).length;
  const cartes = Object.keys(RONDES).map(t => {
    const r = enCours(t), last = closes().filter(x => x.type === t).pop();
    const lastTxt = last ? `Dernière ronde : ${fd(last.debut)}${last.sum.n ? ', ' + plural(last.sum.n, 'anomalie') : ''}` : 'Aucune ronde terminée';
    if (r) {
      const c = cnt(r);
      return `<button class="ronde on" data-a="resume" data-r="${r.id}">
        <div class="row"><span class="n">${RONDES[t].nom}</span><span class="pill">En cours</span></div>
        <div class="d">Commencée ${fdl(r.debut)} à ${ft(r.debut)} par ${esc(r.agent)}</div>
        <div class="bar"><i style="width:${Math.round(100 * c.done / c.t)}%"></i></div>
        <div class="row"><span class="mut small">${c.done} sur ${c.t} points${c.n ? ', ' + plural(c.n, 'non conforme', 'non conformes') : ''}</span><span class="act">Reprendre ›</span></div>
      </button>`;
    }
    const fait = faiteSemaine(t);
    return `<button class="ronde" data-a="new" data-t="${t}">
      <div class="row"><span class="n">${RONDES[t].nom}</span>${fait ? `<span class="pill ok">Faite le ${fd(fait.debut)}</span>` : '<span class="pill ko">À faire cette semaine</span>'}</div>
      <div class="d">${RONDES[t].parcours}</div>
      <div class="row"><span class="mut small">${lastTxt}<br>${totalPoints(t)} points</span><span class="act">Démarrer ›</span></div>
    </button>`;
  }).join('');
  const reste = resteSemaine();
  const semaine = reste.length
    ? `<div class="box warn"><b>${reste.length === 3 ? 'Les 3 contrôles' : plural(reste.length, 'contrôle')} de la semaine à faire</b><br>${reste.map(t => RONDES[t].nom).join(', ')}</div>`
    : `<div class="box" style="border-color:var(--safe);background:var(--safe-bg)"><b>Contrôles de la semaine terminés.</b><br>Prochain rappel lundi à ${RAPPEL.heure} h ${p2(RAPPEL.minute)}.</div>`;
  return `<div class="hero"><img class="mark" src="icon.svg" alt="IGH"><div class="grow"><h1>${esc(BATIMENT)}</h1><p>Ronde de sécurité hebdomadaire</p></div>
    <button class="gear" data-a="go" data-s="param" aria-label="Paramètres">⚙</button></div>
  ${MAJ && MAJ.dispo ? `<button class="box majbox" data-a="go" data-s="param"><b>Mise à jour disponible : ${esc(MAJ.derniere.tag)}</b><br>Appuyez ici pour l’installer.</button>` : ''}
  ${semaine}
  ${DB.agent
    ? `<div class="mut small agentline">Agent : <b>${esc(DB.agent)}</b> · <button class="lk" data-a="go" data-s="param">modifier</button></div>`
    : `<button class="box ko" data-a="go" data-s="param" style="width:100%;text-align:left"><b>Renseignez votre nom</b><br>Il est demandé avant la première ronde : Paramètres.</button>`}
  <h2>Choisissez la ronde à faire</h2>
  ${cartes}
  <div class="tiles">
    <button class="tile" data-a="go" data-s="hist"><b>${closes().length}</b>Rapports de ronde</button>
    <button class="tile ${ouvertes ? 'alert' : ''}" data-a="go" data-s="anom"><b>${ouvertes}</b>${ouvertes > 1 ? 'Anomalies ouvertes' : 'Anomalie ouverte'}</button>
  </div>`;
}

/* ---------- Écran : liste des niveaux d'une ronde ---------- */
function etat(r, s) {
  const k = cnt(r, [s]), ko = s.pts.filter(p => r.r[p.k] && r.r[p.k].v === 'NC').length;
  const cls = ko ? 'ko' : k.rest === 0 ? 'done' : k.done ? 'part' : '';
  const txt = k.rest === 0
    ? (ko ? `<b>${plural(ko, 'non conforme', 'non conformes')}</b>` : '<b>Conforme</b>')
    : k.done ? `${k.done} sur ${k.t} contrôlés${ko ? `, <b>${ko} non conf.</b>` : ''}` : plural(k.t, 'point') + ' à contrôler';
  return { k, cls, txt };
}
function list() {
  const r = cur(), c = cnt(r), L = stationsDe(r);
  const next = L.find(s => cnt(r, [s]).rest > 0);
  return `${topBar('home', RONDES[r.type].nom, `${c.done} sur ${c.t} points · ${plural(c.n, 'non conforme', 'non conformes')}`, '<div id="sv" class="s"></div>')}
  <div style="margin:-12px -14px 12px">${progress(c).replace('class="prog"', 'class="prog" style="margin:0;border-radius:0"')}</div>
  ${next ? `<button class="btn go" data-a="open" data-id="${next.id}">Continuer : ${esc(next.titre)}</button>` : '<div class="box">Tous les points ont reçu une réponse.</div>'}
  <h2>Parcours</h2>
  <div class="floors">${L.map(s => {
    const e = etat(r, s);
    return `<button class="floor ${e.cls}" data-a="open" data-id="${s.id}">
      <span class="ind">${esc(s.court)}</span>
      <span><b>${esc(s.titre === s.court ? s.sous : s.titre)}</b><br><span class="st">${e.txt}</span></span>
      <span class="chev">›</span></button>`;
  }).join('')}</div>
  <div class="dock"><button class="btn ${c.rest ? 'ghost' : ''}" data-a="go" data-s="recap">Terminer la ronde</button></div>`;
}

/* ---------- Écran : contrôle d'un niveau / d'une zone ---------- */
function row(r, p) {
  const x = r.r[p.k];
  return `<div class="pt ${x ? x.v : ''}" data-row="${p.k}">
    <div class="lib"><b>${p.id}</b>${esc(p.lib)}</div>
    <div class="duo"><button class="c" data-a="c" data-k="${p.k}">✓ Conforme</button><button class="n" data-a="nc" data-k="${p.k}">✕ Non conforme</button></div>
    ${x && x.v === 'NC' ? `<div class="note">${esc(x.lieu)} : ${esc(x.com)}${x.ph ? ' (photo)' : ''}</div>` : ''}
    ${x ? `<div class="tm">Répondu à ${ft(x.t)}${x.bloc ? ', validé en bloc' : ''}</div>` : ''}
  </div>`;
}
function stationView() {
  const r = cur(), L = stationsDe(r), i = L.findIndex(s => s.id === V.id), s = L[i], k = cnt(r, [s]);
  let fam = '';
  const suiv = L.slice(i + 1).find(x => cnt(r, [x]).rest > 0) || L[i + 1];
  return `${topBar('list', esc(s.titre), RONDES[r.type].nom + ', ' + esc(s.sous), `<div id="cn" class="t" style="text-align:right">${k.done}/${k.t}</div><div id="sv" class="s"></div>`)}
  ${k.rest ? `<button class="btn ghost" data-a="all" data-id="${s.id}">✓ Tout mettre conforme (${k.rest})</button>` : ''}
  ${s.pts.map(p => (p.fam !== fam ? (fam = p.fam, `<div class="fam">${esc(fam)}</div>`) : '') + row(r, p)).join('')}
  <div class="dock">${suiv
    ? `<button class="btn" data-a="open" data-id="${suiv.id}">Suivant : ${esc(suiv.titre)} ›</button>`
    : `<button class="btn" data-a="go" data-s="recap">Terminer la ronde</button>`}</div>`;
}

/* ---------- Écran : récapitulatif avant clôture ---------- */
function recap() {
  const r = cur(), c = cnt(r), miss = stationsDe(r).filter(s => cnt(r, [s]).rest > 0);
  return `${topBar('list', 'Terminer la ronde', RONDES[r.type].nom + ', ' + fd(r.debut))}
  <div class="kpi"><div class="ok"><b>${c.c}</b><span>conformes</span></div><div class="ko"><b>${c.n}</b><span>non conformes</span></div><div class="${c.rest ? 'wa' : ''}"><b>${c.rest}</b><span>sans réponse</span></div></div>
  ${c.rest === 0
    ? `<div class="box">Les ${c.t} points ont reçu une réponse. Une fois clôturée, la ronde n’est plus modifiable et son rapport PDF est disponible dans « Rapports de ronde ».</div>
       <div class="dock"><button class="btn go" data-a="fin">Clôturer la ronde</button></div>`
    : `<div class="box warn">${plural(c.rest, 'point n’a', 'points n’ont')} pas encore de réponse, sur ${plural(miss.length, 'zone')}.</div>
       <button class="btn" data-a="open" data-id="${miss[0].id}">Aller au premier point sans réponse</button>
       <details><summary>Voir les zones incomplètes</summary>
         ${miss.map(s => `<button class="miss" data-a="open" data-id="${s.id}"><b>${esc(s.titre)}</b><span>${cnt(r, [s]).rest} sans réponse ›</span></button>`).join('')}
       </details>
       <button class="btn ghost" data-a="closeForm">Clôturer quand même…</button>
       <p class="mut small">Une ronde clôturée avec des points sans réponse est marquée « incomplète » dans le rapport, avec le motif saisi.</p>`}
  <button class="link" data-a="drop">Supprimer cette ronde</button>`;
}

/* ---------- Écran : rapport d'une ronde clôturée ---------- */
function anoCard(a, showRonde) {
  const { r, s, p, x } = a, st = x.suivi || 'À traiter', id = `data-r="${r.id}" data-k="${p.k}"`;
  const where = [showRonde ? RONDES[r.type].nom : '', s.titre, x.lieu && x.lieu !== s.titre ? x.lieu : ''].filter(Boolean).join(', ');
  const last = (x.hist || []).slice(-1)[0];
  const coms = (x.coms || []).map(c => `<li><span class="mut small">${fd(c.t)} ${ft(c.t)} · ${esc(c.auteur)}</span><br>${esc(c.txt)}</li>`).join('');
  return `<div class="ano ${x.archive ? 'arch' : st === 'Levée' ? 'levee' : st === 'En cours' ? 'encours' : ''}">
    ${x.ph ? `<button class="tb" data-a="photo" ${id} aria-label="Agrandir la photo"><img class="thumb" src="${x.ph}" alt=""></button>` : ''}
    <div class="w">${p.id} ${esc(p.lib)}</div>
    <div class="mut small">${esc(where)}<br>Constatée le ${fd(x.t)} à ${ft(x.t)}</div>
    <div class="obs">${esc(x.com)}</div>
    ${x.archive
      ? `<div class="pill">Archivée le ${fd(x.archive.t)}</div> <button class="lk" data-a="desarchiver" ${id}>Désarchiver</button>`
      : `<div class="seg">${['À traiter', 'En cours', 'Levée'].map(v =>
          `<button class="${v === st ? 'on' : ''}" data-v="${v}" data-a="suivi" ${id}>${v}</button>`).join('')}</div>
         ${last ? `<div class="tm">${esc(last.s)} depuis le ${fd(last.t)} à ${ft(last.t)}</div>` : ''}`}
    <div class="coms"><div class="mut small"><b>Commentaires de suivi</b>${(x.coms || []).length ? ' (' + x.coms.length + ')' : ''}</div>
      ${coms ? `<ul>${coms}</ul>` : ''}
      <div class="addc"><textarea rows="2" data-cin="${r.id}|${p.k}" placeholder="Ajouter un commentaire (ex. : devis demandé, intervention prévue le 12/10…)"></textarea>
      <button class="btn ghost" data-a="addCom" ${id}>Ajouter le commentaire</button></div>
    </div>
    ${!x.archive && st === 'Levée' ? `<button class="btn ghost" data-a="archiver" ${id}>Archiver cette anomalie levée</button>` : ''}
  </div>`;
}
function rapport() {
  const r = byId(V.id), s = r.sum;
  const nc = anomalies().filter(a => a.r === r);
  return `${topBar('hist', RONDES[r.type].nom, 'Ronde du ' + fd(r.debut))}
  <p><b>${esc(r.agent)}</b>, ${fdl(r.debut)}, de ${ft(r.debut)} à ${ft(r.fin)} (${dur(r)})</p>
  ${r.incomplete ? `<div class="box ko"><b>Ronde incomplète :</b> ${plural(s.rest, 'point', 'points')} sans réponse.<br>Motif : ${esc(r.motif)}</div>` : ''}
  <div class="kpi"><div class="ok"><b>${s.c}</b><span>conformes</span></div><div class="ko"><b>${s.n}</b><span>non conformes</span></div><div class="${s.rest ? 'wa' : ''}"><b>${s.rest}</b><span>sans réponse</span></div></div>
  <button class="btn" data-a="pdf" data-r="${r.id}">Exporter le rapport PDF</button>
  <button class="btn ghost" data-a="csv" data-r="${r.id}">Exporter le détail en CSV (Excel) et les photos</button>
  ${r.signature ? `<div class="box sigbox"><div class="mut small">Signé par <b>${esc(r.signature.nom)}</b> le ${fd(r.signature.t)} à ${ft(r.signature.t)}</div><img src="${r.signature.img}" alt="Signature"></div>` : ''}
  <h2>${nc.length ? plural(nc.length, 'anomalie') : 'Aucune anomalie constatée'}</h2>
  ${nc.map(a => anoCard(a, false)).join('')}`;
}

/* ---------- Écran : rapports de ronde (historique) ---------- */
function hist() {
  const l = closes().filter(r => F.hist === 'all' || r.type === F.hist).reverse();
  const chips = [['all', 'Toutes'], ...Object.keys(RONDES).map(t => [t, RONDES[t].nom])]
    .map(([v, n]) => `<button class="chip ${F.hist === v ? 'on' : ''}" data-a="fHist" data-v="${v}">${n}</button>`).join('');
  return `${topBar('home', 'Rapports de ronde', plural(closes().length, 'ronde clôturée', 'rondes clôturées'))}
  <div class="chips">${chips}</div>
  ${l.length ? l.map(r => `<div class="rec">
      <div class="h"><span class="date">${fd(r.debut)}</span>${r.sum.n ? `<span class="pill ko">${plural(r.sum.n, 'anomalie')}</span>` : '<span class="pill ok">Tout conforme</span>'}</div>
      <div><b>${RONDES[r.type].nom}</b>${r.incomplete ? ' <span class="pill">Incomplète</span>' : ''}</div>
      <div class="mut small">${esc(r.agent)}, de ${ft(r.debut)} à ${ft(r.fin)} (${dur(r)})</div>
      <div class="acts"><button class="btn ghost" data-a="rep" data-r="${r.id}">Ouvrir</button><button class="btn" data-a="pdf" data-r="${r.id}">PDF</button></div>
    </div>`).join('')
    : `<div class="empty">Aucun rapport pour l’instant.<br>Le rapport d’une ronde apparaît ici dès qu’elle est clôturée.</div>`}`;
}

/* ---------- Écran : suivi des anomalies ---------- */
function anom() {
  const all = anomalies().reverse();
  const statut = { open: a => ouverte(a) && !archivee(a), done: a => !ouverte(a) && !archivee(a), arch: archivee, all: () => true };
  const l = all.filter(a => (F.anomRonde === 'all' || a.r.type === F.anomRonde) && statut[F.anomStatut](a));
  const chip = (k, v, n) => `<button class="chip ${F[k] === v ? 'on' : ''}" data-a="fAnom" data-f="${k}" data-v="${v}">${n}</button>`;
  return `${topBar('home', 'Anomalies', plural(all.filter(ouverte).length, 'ouverte', 'ouvertes'))}
  <div class="chips">${chip('anomStatut', 'open', 'Ouvertes')}${chip('anomStatut', 'done', 'Levées')}${chip('anomStatut', 'arch', 'Archivées')}${chip('anomStatut', 'all', 'Toutes')}</div>
  <div class="chips">${chip('anomRonde', 'all', 'Toutes les rondes')}${Object.keys(RONDES).map(t => chip('anomRonde', t, RONDES[t].nom)).join('')}</div>
  ${l.length ? l.map(a => anoCard(a, true)).join('')
    : `<div class="empty">${F.anomStatut === 'open' ? 'Aucune anomalie ouverte.' : 'Aucune anomalie dans cette sélection.'}</div>`}`;
}

/* ---------- Écran : paramètres ---------- */
function param() {
  const taille = Math.round((localStorage.getItem(KEY) || '').length / 1024);
  const m = MAJ;
  return `${topBar('home', 'Paramètres', '')}
  <h2>Agent</h2>
  <div class="agent"><label for="ag">Nom</label><input id="ag" value="${esc(DB.agent)}" placeholder="Prénom Nom" autocomplete="name"></div>
  <p class="mut small">Ce nom est enregistré sur chaque ronde, dans les rapports et avec la signature.</p>

  <h2>Sauvegarde des données</h2>
  <div class="box">
    <p>Toutes les rondes, anomalies, photos et signatures dans un seul fichier, à conserver hors du téléphone
    (messagerie, OneDrive…). Il permet de tout retrouver après un changement de téléphone ou une réinstallation.</p>
    <button class="btn" data-a="backup">Créer une sauvegarde</button>
    <label class="btn ghost">Restaurer une sauvegarde…<input id="imp" type="file" accept="application/json,.json" hidden></label>
    <p class="mut small">Données actuelles : ${plural(DB.rondes.length, 'ronde')}, environ ${taille} Ko.</p>
  </div>

  <h2>Mise à jour de l’application</h2>
  <div class="box">
    <p id="ver">Version installée : ${m ? esc(m.installe.version) : '…'}</p>
    ${m ? (m.dispo
      ? `<p><b>Nouvelle version disponible : ${esc(m.derniere.tag)}</b> (publiée le ${fd(m.derniere.date)})</p>
         <button class="btn go" data-a="majInstall">Installer la mise à jour</button>
         <p class="mut small">Une sauvegarde est créée automatiquement avant l’installation. Android demande ensuite de confirmer.</p>`
      : `<p class="mut">L’application est à jour (dernière version publiée : ${esc(m.derniere.tag || '—')}).</p>`) : ''}
    <button class="btn ghost" data-a="majCheck">Rechercher une mise à jour</button>
  </div>`;
}

/* ---------- Fenêtres ---------- */
function sheet() {
  if (M.kind === 'photo') return `<div class="modal photo" data-a="cancel"><img src="${M.src}" alt="Photo de l’anomalie"></div>`;
  if (M.kind === 'sign') {
    const r = cur();
    return `<div class="modal"><div class="sheet"><h1>Signature</h1>
      <p>${esc(r.agent)} — ronde « ${RONDES[r.type].nom} » du ${fd(r.debut)}${M.motif ? ' <b>(incomplète)</b>' : ''}.<br>
      En signant, vous certifiez avoir réalisé cette ronde. Elle sera clôturée et ne sera plus modifiable.</p>
      <canvas id="sig" class="sig" aria-label="Zone de signature"></canvas>
      <button class="lk" data-a="signClear">Effacer la signature</button>
      <button class="btn go" data-a="signOk">Signer et clôturer</button><button class="btn ghost" data-a="cancel">Annuler</button></div></div>`;
  }
  if (M.kind === 'close') {
    const c = cnt(cur());
    return `<div class="modal"><div class="sheet"><h1>Clôturer la ronde incomplète</h1>
      <p>${plural(c.rest, 'point restera', 'points resteront')} « sans réponse » dans le rapport.</p>
      <label for="motif">Motif (obligatoire)</label><textarea id="motif" rows="3" placeholder="Ex. : accès toiture fermé, clé indisponible"></textarea>
      <button class="btn" data-a="finForce">Clôturer la ronde incomplète</button><button class="btn ghost" data-a="cancel">Annuler</button></div></div>`;
  }
  const { p } = PK[M.k], x = M.x;
  return `<div class="modal"><div class="sheet"><h1 style="color:var(--alarm)">Non conforme</h1><div class="lib"><b>${p.id}</b>${esc(p.lib)}</div>
    <label for="lieu">Lieu</label><input id="lieu" value="${esc(x.lieu)}">
    <label for="ent">Entrée</label><select id="ent">${['', 'n°1', 'n°3'].map(o => `<option ${o === x.ent ? 'selected' : ''}>${o}</option>`).join('')}</select>
    <label for="com">Observation (obligatoire)</label><textarea id="com" rows="3">${esc(x.com)}</textarea>
    <label class="btn ghost" data-a="snap">📷 Prendre ou joindre une photo<input id="ph" type="file" accept="image/*" capture="environment" hidden></label>
    <div id="pv">${x.ph ? `<img src="${x.ph}" alt="">` : ''}</div>
    <button class="btn" data-a="save">Enregistrer l’anomalie</button><button class="btn ghost" data-a="cancel">Annuler</button></div></div>`;
}

/* ---------- Rendu ---------- */
const SCREENS = { home, list, st: stationView, recap, rep: rapport, hist, anom, param };
function render(keepScroll) {
  $('#app').innerHTML = SCREENS[V.s]() + (M ? sheet() : '');
  if (M && M.kind === 'sign') initSignature();
  if (!keepScroll) scrollTo(0, 0);
  rememberScreen();
  showSaved();
}
/* Écran courant + fiche anomalie en cours (brouillon) : retrouvés à la réouverture. */
function rememberScreen() {
  DB.ui = { V, y: Math.round(scrollY), draft: M && M.kind === 'nc' ? { k: M.k, x: M.x } : null };
  save();
}
/* À appeler AVANT le premier affichage (sinon l'accueil écrase l'écran mémorisé). */
function restoreScreen() {
  const ui = DB.ui;
  if (!ui || !ui.V || !SCREENS[ui.V.s]) return;
  const r = cur(), needsRonde = ['list', 'st', 'recap'].includes(ui.V.s);
  if (needsRonde && !(r && r.statut === 'en cours')) return;
  if (ui.V.s === 'rep' && !byId(ui.V.id)) return;
  if (ui.V.s === 'st' && !STATIONS.find(x => x.id === ui.V.id)) return;
  V = ui.V;
  if (ui.draft && r && PK[ui.draft.k]) M = { kind: 'nc', k: ui.draft.k, x: ui.draft.x };
}
/* Mise en arrière-plan / fermeture : on enregistre la position. */
function flush() {
  if (M && M.kind === 'nc' && $('#com')) { M.x.lieu = $('#lieu').value; M.x.ent = $('#ent').value; M.x.com = $('#com').value; }
  rememberScreen();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);
/* Met à jour un seul point sans redessiner l'écran (garde la position). */
function updateRow(k) {
  const el = document.querySelector(`[data-row="${k}"]`), r = cur(), s = PK[k].s, c = cnt(r, [s]);
  el.outerHTML = row(r, PK[k].p);
  $('#cn').textContent = c.done + '/' + c.t;
}
function scrollToNext(k) {
  const rows = [...document.querySelectorAll('.pt')], i = rows.findIndex(e => e.dataset.row === k);
  const n = rows.slice(i + 1).find(e => !e.classList.contains('C') && !e.classList.contains('NC'));
  if (n) n.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function setSuivi(r, k, v) {
  const x = r.r[k];
  if (x.suivi === v) return;
  x.suivi = v;
  x.hist = (x.hist || []).concat({ s: v, t: now() });   // trace de chaque changement de statut
  save();
}
/* Zone de signature au doigt (canvas). Fond blanc pour un rendu identique à l'écran et dans le PDF. */
function initSignature() {
  const c = $('#sig'), ratio = window.devicePixelRatio || 1;
  c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.lineWidth = 2.6 * ratio; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#14212b';
  SIG.traits = 0;
  let enCours = false;
  const pos = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * ratio, (e.clientY - b.top) * ratio]; };
  c.onpointerdown = e => { enCours = true; c.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pos(e)); g.lineTo(...pos(e)); g.stroke(); SIG.traits++; };
  c.onpointermove = e => { if (!enCours) return; g.lineTo(...pos(e)); g.stroke(); };
  c.onpointerup = c.onpointercancel = () => { enCours = false; };
}
function cloturer(r, motif, signature) {
  r.statut = 'clôturée';
  if (signature) r.signature = signature;
  r.fin = now();
  r.sum = cnt(r);
  if (motif) { r.incomplete = true; r.motif = motif; }
  DB.cur = null;
  save();
  V = { s: 'rep', id: r.id };
  M = null;
  render();
  majRappels();
}

/* ---------- Actions (un seul gestionnaire pour tous les boutons data-a) ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a, r = cur();
  switch (a) {
    case 'go': V = { s: b.dataset.s }; render(); break;
    case 'new': {
      const n = (DB.agent || '').trim(), t = b.dataset.t;
      if (!n) { alert('Renseignez d’abord votre nom dans les Paramètres.'); V = { s: 'param' }; render(); return; }
      if (!confirm('Démarrer la ronde « ' + RONDES[t].nom + ' » ?')) return;
      const id = Date.now();
      DB.rondes.push({ id, type: t, debut: now(), agent: n, statut: 'en cours', r: {} });
      DB.cur = id; save(); V = { s: 'list' }; render();
      break;
    }
    case 'resume': DB.cur = +b.dataset.r; save(); V = { s: 'list' }; render(); break;
    case 'open': V = { s: 'st', id: b.dataset.id }; render(); break;
    case 'all': {
      const s = STATIONS.find(x => x.id === b.dataset.id), n = cnt(r, [s]).rest;
      if (!confirm('Mettre ' + n + ' point(s) en CONFORME ?\nPour un point à signaler, appuyez ensuite sur « Non conforme ».')) return;
      const t = now();
      s.pts.forEach(p => { if (!r.r[p.k]) r.r[p.k] = { v: 'C', t, bloc: true }; });
      save(); render(true);
      break;
    }
    case 'c': r.r[b.dataset.k] = { v: 'C', t: now() }; save(); updateRow(b.dataset.k); scrollToNext(b.dataset.k); break;
    case 'nc': {
      const k = b.dataset.k, o = r.r[k] && r.r[k].v === 'NC' ? r.r[k] : {}, s = PK[k].s;
      M = { kind: 'nc', k, x: { lieu: o.lieu || s.titre, ent: o.ent || s.ent, com: o.com || '', ph: o.ph || '' } };
      render(true);
      break;
    }
    case 'cancel': M = null; render(true); break;
    case 'snap': flush(); return;   // juste avant l'appareil photo
    case 'save': {
      const com = $('#com').value.trim();
      if (!com) { $('#com').focus(); $('#com').classList.add('err'); return; }
      r.r[M.k] = { v: 'NC', t: now(), lieu: $('#lieu').value.trim(), ent: $('#ent').value, com, ph: M.x.ph, suivi: 'À traiter' };
      save();
      const k = M.k; M = null; render(true); scrollToNext(k);
      break;
    }
    case 'fin': M = { kind: 'sign' }; render(true); break;
    case 'signClear': initSignature(); break;
    case 'signOk': {
      if (!SIG.traits) { alert('Signez dans le cadre avant de clôturer.'); return; }
      cloturer(r, M.motif, { img: $('#sig').toDataURL('image/png'), nom: r.agent, t: now() });
      break;
    }
    case 'closeForm': M = { kind: 'close' }; render(true); break;
    case 'finForce': {
      const m = $('#motif').value.trim();
      if (!m) { $('#motif').focus(); $('#motif').classList.add('err'); return; }
      M = { kind: 'sign', motif: m }; render(true);
      break;
    }
    case 'drop':
      if (!confirm('Supprimer définitivement cette ronde en cours ? Les réponses saisies seront perdues.')) return;
      if (!confirm('Confirmez la suppression de la ronde « ' + RONDES[r.type].nom + ' » du ' + fd(r.debut) + '.')) return;
      DB.rondes = DB.rondes.filter(x => x !== r); DB.cur = null; save(); V = { s: 'home' }; render();
      break;
    case 'rep': V = { s: 'rep', id: +b.dataset.r }; render(); break;
    case 'pdf': exportPDF(byId(b.dataset.r)); break;
    case 'csv': exportCSV(byId(b.dataset.r)); break;
    case 'suivi': setSuivi(byId(b.dataset.r), b.dataset.k, b.dataset.v); render(true); break;
    case 'photo': M = { kind: 'photo', src: byId(b.dataset.r).r[b.dataset.k].ph }; render(true); break;
    case 'fHist': F.hist = b.dataset.v; render(true); break;
    case 'fAnom': F[b.dataset.f] = b.dataset.v; render(true); break;
    case 'addCom': {
      const ta = document.querySelector(`[data-cin="${b.dataset.r}|${b.dataset.k}"]`), txt = ta.value.trim();
      if (!txt) { ta.focus(); ta.classList.add('err'); return; }
      const x = byId(b.dataset.r).r[b.dataset.k];
      x.coms = (x.coms || []).concat({ t: now(), auteur: DB.agent || 'Agent', txt });
      save(); render(true);
      break;
    }
    case 'archiver': {
      const x = byId(b.dataset.r).r[b.dataset.k];
      if (!confirm('Archiver cette anomalie levée ? Elle n’apparaîtra plus que dans le filtre « Archivées ».')) return;
      x.archive = { t: now() }; x.hist = (x.hist || []).concat({ s: 'Archivée', t: x.archive.t });
      save(); render(true);
      break;
    }
    case 'desarchiver': {
      const x = byId(b.dataset.r).r[b.dataset.k];
      delete x.archive; x.hist = (x.hist || []).concat({ s: 'Désarchivée', t: now() });
      save(); render(true);
      break;
    }
    case 'backup': exporterSauvegarde(); break;
    case 'majCheck':
      b.disabled = true; b.textContent = 'Recherche en cours…';
      chercherMaj().then(() => render(true)).catch(e => { alert('Recherche impossible : ' + e.message + '\nVérifiez la connexion internet.'); render(true); });
      break;
    case 'majInstall': installerMaj(); break;
  }
});

/* Nom du contrôleur mémorisé dès la saisie */
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'ag') { DB.agent = e.target.value.trim(); save(); }
  if (e.target.dataset && e.target.dataset.cin) e.target.classList.remove('err');
  if (M && M.kind === 'nc' && (id === 'lieu' || id === 'com' || id === 'ent')) { M.x[id] = e.target.value; rememberScreen(); }
});

/* Photo : réduite à 900 px (JPEG) pour ne pas saturer la mémoire du téléphone */
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ent' && M && M.kind === 'nc') { M.x.ent = t.value; rememberScreen(); }
  if (t.id === 'imp' && t.files[0]) { const fr = new FileReader(); fr.onload = () => restaurer(fr.result); fr.readAsText(t.files[0]); t.value = ''; return; }
  if (t.id !== 'ph' || !t.files[0]) return;
  M.x.lieu = $('#lieu').value; M.x.ent = $('#ent').value; M.x.com = $('#com').value;
  rememberScreen();
  const im = new Image(), fr = new FileReader();
  fr.onload = () => {
    im.onload = () => {
      const q = 900 / Math.max(im.width, im.height, 900), c = document.createElement('canvas');
      c.width = im.width * q; c.height = im.height * q;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      M.x.ph = c.toDataURL('image/jpeg', 0.6);
      $('#pv').innerHTML = '<img src="' + M.x.ph + '" alt="">';
      rememberScreen();   // la photo est gardée même si l'appli est fermée avant « Enregistrer »
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(t.files[0]);
});

/* Bouton retour Android (APK) : écran précédent ; false sur l'accueil = quitter l'appli. */
const PREV = { st: 'list', list: 'home', recap: 'list', rep: 'hist', hist: 'home', anom: 'home', param: 'home' };
window.onBack = () => {
  if (M) { M = null; render(true); return true; }
  const p = PREV[V.s];
  if (!p) return false;
  V = { s: p }; render(); return true;
};

const startY = (DB.ui && DB.ui.y) || 0;
restoreScreen();
render(true);
majRappels();
scrollTo(0, startY);
majAuDemarrage();
