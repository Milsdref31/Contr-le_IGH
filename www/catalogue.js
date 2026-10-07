/* =====================================================================
   CATALOGUE DES POINTS DE CONTRÔLE ET ORDRE DES RONDES
   C'est le seul fichier à modifier pour ajouter / retirer / renommer un point.
   ===================================================================== */

/* Niveaux parcourus dans chaque entrée, dans l'ordre de la ronde : descente du R+18 au RDC, puis le hall. */
const NIVEAUX = [];
for (let i = 18; i >= 1; i--) NIVEAUX.push('R+' + i);
NIVEAUX.push('RDC');

/* Entrées concernées, et niveau où se trouve la centrale de désenfumage (SSI) de chacune :
   ses points sont contrôlés avec ce niveau. */
const ENTREES = [1, 3];
const NIVEAU_SSI = { 1: 'RDC', 3: 'R+1' };

/* Points de contrôle : [référence, famille, libellé, fréquence]
   fréquence : 'o' = une fois par ronde · 'l' = à chaque niveau de l'entrée */
const POINTS = [
  ['1.1', 'Extérieur', 'Voie publique / portail / barrières : voie accessible', 'o'],
  ['1.2', 'Extérieur', 'Absence de stationnement gênant', 'o'],
  ['1.3', 'Extérieur', 'Absence d’encombrants sur les voies et façades', 'o'],
  ['1.4', 'Extérieur', 'Accès à l’alimentation des colonnes sèches : signalétique présente et état général', 'o'],
  ['1.5', 'Extérieur', 'Porte d’entrée : ouverture correcte et complète', 'o'],
  ['1.6', 'Extérieur', 'Vérification du local poubelles', 'o'],
  ['1.7', 'Extérieur', 'Vérification du local surpresseur', 'o'],
  ['1.8', 'Extérieur', 'Vérification du local ménage', 'o'],
  ['2.1', 'Hall', 'Hall non encombré, y compris le demi-niveau d’accès à la cage d’escalier et aux ascenseurs', 'o'],
  ['3.1', 'Escalier', 'Escalier libre de tout encombrement / dépôt / squat', 'l'],
  ['3.2', 'Escalier', 'État général : propreté, sol non glissant, main courante, fenêtres à châssis fixe', 'l'],
  ['3.3', 'Escalier', 'Éclairage de sécurité en fonctionnement (niveau et demi-niveau)', 'l'],
  ['4.1', 'Portes coupe-feu', 'Fermeture complète de chaque battant', 'l'],
  ['4.2', 'Portes coupe-feu', 'État général et étanchéité', 'l'],
  ['5.1', 'Éclairages', 'Éclairage / plafonnier fonctionnel', 'l'],
  ['5.2', 'Éclairages', 'Éclairage de sécurité fonctionnel', 'l'],
  ['6.1', 'Encombrement', 'Palier libre de tout encombrement / dépôt', 'l'],
  ['7.1', 'Placards / volumes techniques', 'Fermés et verrouillés (gaz, vide-ordures, électrique…)', 'l'],
  ['7.2', 'Placards / volumes techniques', 'Aucun dépôt', 'l'],
  ['7.3', 'Placards / volumes techniques', 'Tableaux électriques correctement fermés', 'l'],
  ['7.4', 'Placards / volumes techniques', 'Absence de câbles apparents ou dénudés / pièces nues sous tension', 'l'],
  ['8.1', 'Désenfumage', 'Volets de désenfumage : présence de la grille', 'l'],
  ['8.2', 'Désenfumage', 'État apparent général non dégradé (visible depuis le placard électrique)', 'l'],
  ['9.1', 'Colonnes sèches', 'Fermeture des robinets', 'l'],
  ['9.2', 'Colonnes sèches', 'Présence et fermeture des bouchons', 'l'],
  ['10.1', 'Détection incendie', 'Témoin lumineux fonctionnel', 'l'],
  ['11.1', 'Documents affichés', 'Présence des plans d’évacuation et consignes', 'l'],
  ['12.1', 'Toiture-terrasse', 'Accès verrouillés / grilles', 'o'],
  ['12.2', 'Toiture-terrasse', 'Cheminements', 'o'],
  ['12.3', 'Toiture-terrasse', 'Garde-corps', 'o'],
  ['12.4', 'Toiture-terrasse', 'Cheminées', 'o'],
  ['12.5', 'Toiture-terrasse', 'Locaux « machinerie ascenseurs »', 'o'],
  ['12.6', 'Toiture-terrasse', 'Absence de signe d’activité autre que la maintenance des installations techniques', 'o'],
  ['13.1', 'Centrale de désenfumage', 'SSI en veille générale', 'o'],
  ['13.2', 'Centrale de désenfumage', 'Absence de défaut / voyant orange ou rouge', 'o'],
];

/* Rappel : du lundi au vendredi à cette heure, tant que les 3 rondes de la semaine ne sont pas clôturées (APK). */
const RAPPEL = { heure: 8, minute: 30, jours: [1, 2, 3, 4, 5] };   // 1 = lundi … 5 = vendredi

/* Les trois rondes, choisies séparément depuis l'accueil. */
const RONDES = {
  e1: { nom: 'Entrée n°1', parcours: 'R+18 à RDC (centrale SSI au RDC), puis hall' },
  e3: { nom: 'Entrée n°3', parcours: 'R+18 à RDC (centrale SSI au R+1), puis hall' },
  g:  { nom: 'Général',    parcours: 'Extérieur, toiture-terrasse' },
};

/* ---------- Construction des « stations » (un arrêt = un écran de contrôle) ---------- */
const famille = f => POINTS.filter(p => p[1] === f);
const parNiveau = POINTS.filter(p => p[3] === 'l');

/* Une station : id unique, titre affiché, sous-titre, entrée, ronde, points à contrôler. */
function station(id, titre, sous, ent, ronde, pts, court) {
  return {
    id, titre, sous, ent, ronde,
    court: court || titre,              // texte de l'afficheur d'étage (liste)
    pts: pts.map(p => ({ k: id + '|' + p[0], id: p[0], fam: p[1], lib: p[2] })),
  };
}

const STATIONS = [];
ENTREES.forEach(e => {
  const ronde = 'e' + e, ent = 'n°' + e;
  NIVEAUX.forEach(n => {
    const ssi = NIVEAU_SSI[e] === n;
    STATIONS.push(station(ronde + '-' + n, n, 'Escalier, paliers, placards' + (ssi ? ', centrale SSI' : ''), ent, ronde,
      ssi ? parNiveau.concat(famille('Centrale de désenfumage')) : parNiveau));
  });
  STATIONS.push(station(ronde + '-hall', 'Hall', 'Rez-de-chaussée et demi-niveau', ent, ronde, famille('Hall')));
});
STATIONS.push(station('ext', 'Extérieur', 'Voie, portail, locaux', '', 'g', famille('Extérieur'), 'Ext.'));
STATIONS.push(station('toit', 'Toiture-terrasse', 'Accès, cheminements, garde-corps', '', 'g', famille('Toiture-terrasse'), 'Toit'));

/* Index : clé de point -> { point, station } */
const PK = {};
STATIONS.forEach(s => s.pts.forEach(p => { PK[p.k] = { p, s }; }));

/* Stations d'une ronde donnée (objet ronde ou code 'e1' / 'e3' / 'g'). */
const stationsDe = r => STATIONS.filter(s => s.ronde === (r.type || r));
const totalPoints = t => stationsDe(t).reduce((a, s) => a + s.pts.length, 0);
