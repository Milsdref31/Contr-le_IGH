/* =====================================================================
   RONDE LA TOUR — logique de l'application
   Données : stockées sur le téléphone (localStorage), aucun serveur.
   Dépend de : catalogue.js (points), pdf.js (rapport), native.js (APK).
   ===================================================================== */

/* ---------- Données ---------- */
const KEY = 'ronde_latour_v3';        // v3 : une ronde par entrée. Les données v2 restent sous leur ancienne clé.
let DB;
try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* stockage illisible : on repart à vide */ }
DB = DB || { rondes: [], cur: null, agent: '' };

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch (e) { alert('Mémoire du téléphone pleine. Exportez puis supprimez d’anciennes rondes.'); }
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

/* ---------- Fichiers exportés : AAAA-MM-JJ_Ronde_LA-TOUR_Entree-1.pdf ---------- */
const SLUG = { e1: 'Entree-1', e3: 'Entree-3', g: 'General' };
const day = r => { const t = new Date(r.debut); return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()); };
const fname = r => day(r) + '_Ronde_LA-TOUR_' + SLUG[r.type];

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
  if (NATIVE) return Native.saveAndShare(doc.output('blob'), name, day(r));
  const f = new File([doc.output('blob')], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  doc.save(name);
}

function exportCSV(r) {
  const L = [['Date', 'Heure', 'Contrôleur', 'Bâtiment', 'Ronde', 'Entrée', 'Niveau / zone', 'Point', 'Famille', 'Libellé',
    'Résultat', 'Lieu anomalie', 'Observation', 'Photo', 'Suivi', 'Mode']];
  stationsDe(r).forEach(s => s.pts.forEach(p => {
    const x = r.r[p.k];
    L.push([x ? fd(x.t) : '', x ? ft(x.t) : '', r.agent, 'LA TOUR', RONDES[r.type].nom, s.ent || (x && x.ent) || '', s.titre,
      p.id, p.fam, p.lib, x ? (x.v === 'C' ? 'Conforme' : 'Non conforme') : 'MANQUANT',
      (x && x.lieu) || '', (x && x.com) || '', x && x.ph ? 'oui' : '', (x && x.suivi) || '',
      x ? (x.bloc ? 'en bloc' : 'unitaire') : '']);
  }));
  const txt = '﻿' + L.map(l => l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const b = new Blob([txt], { type: 'text/csv' });
  if (NATIVE) return Native.saveAndShare(b, fname(r) + '.csv', day(r));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = fname(r) + '.csv';
  a.click();
}

/* ---------- Navigation ----------
   V = écran courant, M = fenêtre ouverte (anomalie, clôture, photo), F = filtres */
let V = { s: 'home' }, M = null;
const F = { hist: 'all', anomStatut: 'open', anomRonde: 'all' };

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
    return `<button class="ronde" data-a="new" data-t="${t}">
      <div class="row"><span class="n">${RONDES[t].nom}</span><span class="mut small">${totalPoints(t)} points</span></div>
      <div class="d">${RONDES[t].parcours}</div>
      <div class="row"><span class="mut small">${lastTxt}</span><span class="act">Démarrer ›</span></div>
    </button>`;
  }).join('');
  return `<div class="hero"><h1>LA TOUR</h1><p>Ronde de sécurité hebdomadaire</p></div>
  <div class="agent"><label for="ag">Contrôleur</label><input id="ag" value="${esc(DB.agent)}" placeholder="Nom Prénom" autocomplete="name"></div>
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
  return `${topBar('home', RONDES[r.type].nom, `${c.done} sur ${c.t} points · ${plural(c.n, 'non conforme', 'non conformes')}`)}
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
  return `${topBar('list', esc(s.titre), RONDES[r.type].nom + ', ' + esc(s.sous), `<span id="cn" class="s">${k.done}/${k.t}</span>`)}
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
  const { r, s, p, x } = a, st = x.suivi || 'À traiter';
  const where = [showRonde ? RONDES[r.type].nom : '', s.titre, x.lieu && x.lieu !== s.titre ? x.lieu : ''].filter(Boolean).join(', ');
  const last = (x.hist || []).slice(-1)[0];
  return `<div class="ano ${st === 'Levée' ? 'levee' : st === 'En cours' ? 'encours' : ''}">
    ${x.ph ? `<button class="tb" data-a="photo" data-r="${r.id}" data-k="${p.k}" aria-label="Agrandir la photo"><img class="thumb" src="${x.ph}" alt=""></button>` : ''}
    <div class="w">${p.id} ${esc(p.lib)}</div>
    <div class="mut small">${esc(where)}<br>Constatée le ${fd(x.t)} à ${ft(x.t)}</div>
    <div class="obs">${esc(x.com)}</div>
    <div class="seg">${['À traiter', 'En cours', 'Levée'].map(v =>
      `<button class="${v === st ? 'on' : ''}" data-v="${v}" data-a="suivi" data-r="${r.id}" data-k="${p.k}">${v}</button>`).join('')}</div>
    ${last ? `<div class="tm">${esc(last.s)} depuis le ${fd(last.t)} à ${ft(last.t)}</div>` : ''}
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
  <button class="btn ghost" data-a="csv" data-r="${r.id}">Exporter le détail en CSV (Excel)</button>
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
  const l = all.filter(a => (F.anomRonde === 'all' || a.r.type === F.anomRonde)
    && (F.anomStatut === 'all' || (F.anomStatut === 'open' ? ouverte(a) : !ouverte(a))));
  const chip = (k, v, n) => `<button class="chip ${F[k] === v ? 'on' : ''}" data-a="fAnom" data-f="${k}" data-v="${v}">${n}</button>`;
  return `${topBar('home', 'Anomalies', plural(all.filter(ouverte).length, 'ouverte', 'ouvertes'))}
  <div class="chips">${chip('anomStatut', 'open', 'Ouvertes')}${chip('anomStatut', 'done', 'Levées')}${chip('anomStatut', 'all', 'Toutes')}</div>
  <div class="chips">${chip('anomRonde', 'all', 'Toutes les rondes')}${Object.keys(RONDES).map(t => chip('anomRonde', t, RONDES[t].nom)).join('')}</div>
  ${l.length ? l.map(a => anoCard(a, true)).join('')
    : `<div class="empty">${F.anomStatut === 'open' ? 'Aucune anomalie ouverte.' : 'Aucune anomalie dans cette sélection.'}</div>`}`;
}

/* ---------- Fenêtres ---------- */
function sheet() {
  if (M.kind === 'photo') return `<div class="modal photo" data-a="cancel"><img src="${M.src}" alt="Photo de l’anomalie"></div>`;
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
    <label class="btn ghost">📷 Prendre ou joindre une photo<input id="ph" type="file" accept="image/*" capture="environment" hidden></label>
    <div id="pv">${x.ph ? `<img src="${x.ph}" alt="">` : ''}</div>
    <button class="btn" data-a="save">Enregistrer l’anomalie</button><button class="btn ghost" data-a="cancel">Annuler</button></div></div>`;
}

/* ---------- Rendu ---------- */
const SCREENS = { home, list, st: stationView, recap, rep: rapport, hist, anom };
function render(keepScroll) {
  $('#app').innerHTML = SCREENS[V.s]() + (M ? sheet() : '');
  if (!keepScroll) scrollTo(0, 0);
}
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
function cloturer(r, motif) {
  r.statut = 'clôturée';
  r.fin = now();
  r.sum = cnt(r);
  if (motif) { r.incomplete = true; r.motif = motif; }
  DB.cur = null;
  save();
  V = { s: 'rep', id: r.id };
  M = null;
  render();
}

/* ---------- Actions (un seul gestionnaire pour tous les boutons data-a) ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a, r = cur();
  switch (a) {
    case 'go': V = { s: b.dataset.s }; render(); break;
    case 'new': {
      const n = $('#ag').value.trim(), t = b.dataset.t;
      if (!n) { $('#ag').focus(); $('#ag').parentNode.classList.add('err'); return; }
      if (!confirm('Démarrer la ronde « ' + RONDES[t].nom + ' » ?')) return;
      DB.agent = n;
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
    case 'save': {
      const com = $('#com').value.trim();
      if (!com) { $('#com').focus(); $('#com').classList.add('err'); return; }
      r.r[M.k] = { v: 'NC', t: now(), lieu: $('#lieu').value.trim(), ent: $('#ent').value, com, ph: M.x.ph, suivi: 'À traiter' };
      save();
      const k = M.k; M = null; render(true); scrollToNext(k);
      break;
    }
    case 'fin':
      if (confirm('Clôturer la ronde « ' + RONDES[r.type].nom + ' » ? Elle ne sera plus modifiable.')) cloturer(r);
      break;
    case 'closeForm': M = { kind: 'close' }; render(true); break;
    case 'finForce': {
      const m = $('#motif').value.trim();
      if (!m) { $('#motif').focus(); $('#motif').classList.add('err'); return; }
      cloturer(r, m);
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
  }
});

/* Nom du contrôleur mémorisé dès la saisie */
document.addEventListener('input', e => {
  if (e.target.id === 'ag') { DB.agent = e.target.value.trim(); save(); e.target.parentNode.classList.remove('err'); }
});

/* Photo : réduite à 900 px (JPEG) pour ne pas saturer la mémoire du téléphone */
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id !== 'ph' || !t.files[0]) return;
  M.x.lieu = $('#lieu').value; M.x.ent = $('#ent').value; M.x.com = $('#com').value;
  const im = new Image(), fr = new FileReader();
  fr.onload = () => {
    im.onload = () => {
      const q = 900 / Math.max(im.width, im.height, 900), c = document.createElement('canvas');
      c.width = im.width * q; c.height = im.height * q;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      M.x.ph = c.toDataURL('image/jpeg', 0.6);
      $('#pv').innerHTML = '<img src="' + M.x.ph + '" alt="">';
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(t.files[0]);
});

/* Bouton retour Android (APK) : écran précédent ; false sur l'accueil = quitter l'appli. */
const PREV = { st: 'list', list: 'home', recap: 'list', rep: 'hist', hist: 'home', anom: 'home' };
window.onBack = () => {
  if (M) { M = null; render(true); return true; }
  const p = PREV[V.s];
  if (!p) return false;
  V = { s: p }; render(); return true;
};

if (!NATIVE && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
