# Contrôle IGH — Ronde de sécurité hebdomadaire

Application Android de **ronde hebdomadaire de sécurité** d'un immeuble de grande hauteur (IGH).
Elle remplace le questionnaire Microsoft Forms : l'agent parcourt le bâtiment, répond *Conforme* ou
*Non conforme* à chaque point, et obtient un rapport PDF daté à transmettre au mandataire sécurité.

> **Confidentialité des données** — Toutes les données (réponses, observations, photos, nom de l'agent) sont
> stockées **uniquement sur le téléphone de l'agent**. Aucun serveur ne les reçoit. Elles ne sont accessibles
> à une autre personne **que si l'agent partage lui-même le rapport, en PDF ou en CSV**.

Ce document comporte deux parties :

- **[Partie 1 — Utilisation](#partie-1--utilisation)** : pour les gestionnaires et l'administration ;
- **[Partie 2 — Fiche technique](#partie-2--fiche-technique-dsin)** : pour la DSIN (architecture, sécurité, compilation, maintenance).

---

## Partie 1 — Utilisation

### Ce que fait l'application

| Fonction | Description |
|---|---|
| Trois rondes séparées | **Entrée n°1**, **Entrée n°3** et **Général**, choisies depuis l'accueil. Chacune se démarre, se clôture et s'exporte indépendamment. |
| Saisie rapide | Deux gros boutons par point : **✓ Conforme** / **✕ Non conforme**. Le bouton « Tout mettre conforme » valide d'un coup les points restants d'un niveau. |
| Fiche anomalie | En cas de non-conformité : lieu et entrée pré-remplis, observation obligatoire, photo facultative. |
| Traçabilité | Chaque réponse est horodatée. Le rapport indique le nom de l'agent, l'heure de début, de fin et la durée. |
| Clôture contrôlée | Une ronde ne se clôture normalement que si tous les points ont une réponse (voir [Règles](#règles-de-traçabilité)). |
| Rapports | Rapport **PDF** (synthèse, anomalies avec photos, détail de tous les points) et export **CSV** pour Excel. |
| Suivi des anomalies | Statut *À traiter* → *En cours* → *Levée*, avec la date de chaque changement. |
| Rappels | Notification du lundi au vendredi vers 8 h 30 tant que les 3 rondes de la semaine ne sont pas faites. |
| Enregistrement automatique | Tout est enregistré en continu. Si l'application est fermée, elle rouvre exactement là où l'on s'était arrêté. |
| Hors ligne | Aucun réseau nécessaire pendant la ronde. |

### Parcours des rondes (configuration actuelle)

L'ordre des écrans suit le déplacement réel dans le bâtiment. Le nom du bâtiment, les entrées, les niveaux
et les points de contrôle se règlent dans [`www/catalogue.js`](www/catalogue.js).

| Ronde | Parcours | Points |
|---|---|---|
| Entrée n°1 | R+18 → R+17 → … → R+1 → **RDC (avec la centrale SSI)** → Hall | 345 |
| Entrée n°3 | R+18 → … → R+2 → **R+1 (avec la centrale SSI)** → RDC → Hall | 345 |
| Général | Extérieur → Toiture-terrasse | 14 |

À chaque niveau : escalier, portes coupe-feu, éclairages, encombrement, placards techniques,
désenfumage, colonnes sèches, détection incendie, documents affichés (18 points).
La liste complète des points figure dans [`www/catalogue.js`](www/catalogue.js).

### Installer l'application

1. Sur le téléphone Android, ouvrir la page **Releases** du dépôt et télécharger le dernier fichier
   `Controle-IGH-v1.0.N.apk`.
2. Ouvrir le fichier et autoriser l'installation (« sources inconnues ») si le téléphone le demande.
3. Au premier lancement, **autoriser les notifications** (nécessaire pour les rappels).

Configuration requise : Android 7.0 ou plus récent.

### Faire une ronde

1. **Accueil** : saisir son nom (« Contrôleur »), puis appuyer sur la ronde à faire.
2. **Parcours** : la liste des niveaux s'affiche. Le bouton vert « Continuer » ouvre le prochain niveau à contrôler.
3. **Niveau** : répondre à chaque point. En cas d'anomalie, remplir la fiche (observation, photo).
   Le bouton du bas passe au niveau suivant.
4. **Terminer la ronde** : vérifier le récapitulatif puis appuyer sur « Clôturer la ronde ».
5. **Rapport** : le rapport s'affiche. « Exporter le rapport PDF » l'enregistre sur le téléphone et ouvre
   le menu de partage (messagerie, Teams…) pour l'envoyer au mandataire.

Une ronde interrompue reste « En cours » sur l'accueil : il suffit d'appuyer dessus pour la reprendre.

### Où trouver les rapports

- Dans l'application : **Rapports de ronde** (accueil), avec un bouton PDF par ronde.
- Sur le téléphone : dossier `Documents/Contrôle IGH/AAAA-MM-JJ/`
- Nom des fichiers : `AAAA-MM-JJ_Ronde_<bâtiment>_Entree-1.pdf` (ou `Entree-3`, `General`, et `.csv`).
  Le format année-mois-jour permet un classement chronologique automatique.

### Règles de traçabilité

- Chaque point doit recevoir une réponse. Une observation est obligatoire pour toute non-conformité.
- « Tout mettre conforme » ne remplit que les points sans réponse ; ils sont marqués **« validé en bloc »**
  dans le rapport (astérisque) et dans le CSV.
- Clôture normale : uniquement quand tous les points ont une réponse.
- Clôture anticipée (« Clôturer quand même ») : un **motif est obligatoire** ; la ronde est marquée
  **« incomplète »** à l'écran et dans le PDF, et les points sans réponse y figurent comme « MANQUANT ».
- Une ronde clôturée n'est plus modifiable. Seul le statut de suivi des anomalies peut évoluer, et chaque
  changement est daté.
- Une ronde en cours peut être supprimée (double confirmation) ; une ronde clôturée ne peut pas l'être.

### Rappels hebdomadaires

- Du **lundi au vendredi vers 8 h 30**, une notification rappelle les rondes restant à faire dans la semaine.
- Les rappels s'arrêtent dès que les 3 rondes (Entrée n°1, Entrée n°3, Général) sont clôturées, et reprennent
  le lundi suivant. Une ronde compte pour la semaine où elle a été commencée.
- L'accueil affiche également les contrôles restants de la semaine.

### Points d'attention

- **Les données sont stockées uniquement sur le téléphone de l'agent** (aucun serveur, aucune synchronisation).
  Le gestionnaire, le mandataire ou toute autre personne n'y ont accès **que si l'agent partage le rapport
  en PDF ou en CSV** (messagerie, Teams…).
- Désinstaller l'application ou effacer ses données supprime l'historique : **conserver les PDF exportés**, qui font foi.
- Une mise à jour de l'application conserve les données, à condition d'être signée avec la même clé
  (voir [Signature](#signature-de-lapplication)).

---

## Partie 2 — Fiche technique (DSIN)

### Architecture

```
┌──────────────── APK Android ────────────────┐
│  WebView                                     │
│   www/  HTML + CSS + JavaScript (sans build) │
│     │                                        │
│     └── pont Capacitor ──► plugins natifs :  │
│           Filesystem   enregistrement PDF/CSV│
│           Share        menu de partage       │
│           App          bouton retour         │
│           LocalNotifications  rappels        │
│                                              │
│  Stockage : localStorage de la WebView       │
└──────────────────────────────────────────────┘
        Aucun serveur, aucun appel réseau.
```

- **Interface** : application web statique (HTML/CSS/JavaScript, sans framework ni étape de compilation),
  embarquée dans un APK par [Capacitor](https://capacitorjs.com/).
- **PDF** : généré sur le téléphone par la bibliothèque jsPDF.
- **Données** : objet JSON dans le `localStorage` de la WebView (clé `ronde_latour_v3`), enregistré à chaque action.
- **Réseau** : aucun. L'application fonctionne entièrement hors ligne.

### Arborescence

```
www/                        application (seul dossier à modifier pour le fonctionnel)
  catalogue.js              ► nom du bâtiment, points de contrôle, niveaux, ordre des rondes, niveau de la SSI, heure des rappels
  app.js                    écrans, actions, enregistrement, exports CSV, calcul des rappels
  pdf.js                    mise en page du rapport PDF
  native.js                 liaison avec Android (fichiers, partage, retour, notifications)
  style.css                 mise en forme
  index.html                page unique, ordre de chargement des scripts
  jspdf.umd.min.js          bibliothèque jsPDF 4.2.1 (MIT)
  fonts/                    police Barlow (licence OFL) embarquée
  icon.svg, logo.png        logo (en-tête de l'accueil, en-tête du PDF)
android/                    projet Android (manifeste, icônes, signature) — généré par Capacitor
tools/make_logo.py          dessine le logo et régénère toutes les icônes
tools/BarlowCondensed-Bold.ttf, tools/OFL-Barlow.txt   police utilisée par make_logo.py
.github/workflows/apk.yml   compilation automatique de l'APK
capacitor.config.json       identifiant de l'application, réglages des notifications
package.json                dépendances (versions figées)
```

### Technologies et versions

| Élément | Version |
|---|---|
| Capacitor (core, android, cli) | 8.5.2 |
| Plugins Capacitor | app 8.1.2 · filesystem 8.1.4 · share 8.0.3 · local-notifications 8.3.1 |
| jsPDF | 4.2.1 |
| Android | minSdk 24 (Android 7.0) · targetSdk 36 |
| Compilation | Node.js 22 · JDK 21 (Temurin) · Gradle (wrapper du projet) |
| Identifiant de l'application | `fr.tmh.ronde.latour` |

### Données et sécurité

| Sujet | Situation |
|---|---|
| Hébergement des données | **Uniquement sur le téléphone de l'agent** (`localStorage` de la WebView, espace privé de l'application, inaccessible aux autres applications). |
| Données personnelles | Nom de l'agent saisi, horodatages, photos d'anomalies. Aucune donnée transmise automatiquement. |
| Accès par un tiers | **Uniquement si l'agent partage le rapport en PDF ou en CSV**, par le menu de partage Android. Il n'existe aucun autre moyen de consulter les données. |
| Réseau | Aucun appel réseau. La permission `INTERNET` est présente par défaut dans le modèle Capacitor, sans usage. |
| Permissions Android | `POST_NOTIFICATIONS` (rappels) · `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` (rappels conservés après redémarrage) · `READ/WRITE_EXTERNAL_STORAGE` limitées à Android ≤ 10 (écriture dans `Documents`). |
| Sauvegarde | Aucune sauvegarde centrale. Les PDF exportés constituent la trace officielle. |
| Code source | Dépôt public : il ne contient aucune donnée de ronde, aucun mot de passe ni aucune clé. |

### Compilation de l'APK

La compilation est automatique (GitHub Actions, [`.github/workflows/apk.yml`](.github/workflows/apk.yml)) :

1. Chaque envoi sur la branche `main` (ou **Actions › APK Android › Run workflow**) lance la compilation (~5 min).
2. Le workflow installe les dépendances, copie `www/` dans le projet Android, compile en mode *release*,
   vérifie la signature (`apksigner verify`), puis publie l'APK dans **Releases**.
3. Le numéro de version suit le numéro de compilation : `v1.0.N`.

Compilation sur un poste (facultatif) — prérequis : Node.js 22, JDK 21, Android SDK :

```bash
npm ci
npm run apk:debug     # APK de test : android/app/build/outputs/apk/debug/app-debug.apk
npm run apk:release   # APK signé (variables d'environnement de signature ci-dessous)
```

Après toute modification de `www/`, la commande `npx cap sync android` recopie l'application dans le projet Android
(étape incluse dans les commandes ci-dessus et dans le workflow).

### Signature de l'application

Android n'installe une mise à jour **par-dessus** la version existante (donc sans perte de données) que si elle est
signée avec **la même clé**. La clé est fournie au workflow par quatre secrets du dépôt
(**Settings › Secrets and variables › Actions**) :

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | fichier de clé `.jks` encodé en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du fichier de clé |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |
| `ANDROID_KEY_ALIAS` | alias de la clé |

- Sans ces secrets, l'APK est signé avec une clé temporaire et porte le suffixe **`-TEST`** : à réserver aux essais.
- Le fichier `.jks` et son mot de passe doivent être **conservés en lieu sûr** (coffre-fort de mots de passe DSIN) :
  une clé perdue empêche toute mise à jour sans désinstallation.
- Les fichiers de clé sont exclus du dépôt (`.gitignore`).

### Maintenance courante

| Besoin | Où intervenir |
|---|---|
| Changer le nom du bâtiment (accueil, rapports, noms de fichiers) | `www/catalogue.js`, `BATIMENT` |
| Ajouter, retirer, renommer un point de contrôle | `www/catalogue.js`, tableau `POINTS` (fréquence `o` = une fois par ronde, `l` = à chaque niveau) |
| Changer l'ordre ou la liste des niveaux | `www/catalogue.js`, `NIVEAUX` |
| Changer le niveau de la centrale SSI | `www/catalogue.js`, `NIVEAU_SSI = { 1: 'RDC', 3: 'R+1' }` |
| Changer l'heure ou les jours des rappels | `www/catalogue.js`, `RAPPEL = { heure: 8, minute: 30, jours: [1, 2, 3, 4, 5] }` |
| Modifier le rapport PDF | `www/pdf.js` |
| Modifier le logo ou les icônes | `tools/make_logo.py`, puis `python3 tools/make_logo.py` (Pillow et fontTools requis) |

Après modification : envoyer sur `main`, attendre la compilation, installer le nouvel APK depuis **Releases**.

> Les réponses sont rattachées à l'identifiant d'un point (ex. `e1-R+5|3.1`). Renommer le **libellé** d'un point est
> sans risque ; changer sa **référence** ou retirer un niveau rend les réponses correspondantes des anciennes rondes
> invisibles dans l'application (les PDF déjà exportés restent valables).

### Vérification dans un navigateur

Pour contrôler une modification sans compiler l'APK, servir le dossier `www/` en local
(par exemple `python3 -m http.server` dans `www/`) et l'ouvrir dans un navigateur d'ordinateur.
Toutes les fonctions sont utilisables, sauf celles propres à Android : enregistrement dans `Documents`,
menu de partage (remplacé par un téléchargement), bouton retour et notifications.

### Limites connues

- Pas de partage multi-utilisateurs ni de consultation à distance : chaque téléphone a son propre historique,
  consultable par un tiers uniquement via les PDF / CSV partagés par l'agent.
  Une évolution vers un stockage central (SharePoint / Microsoft Lists, serveur interne) est possible si le besoin apparaît.
- Les rappels sont « vers 8 h 30 » : Android peut décaler légèrement une alarme non exacte pour économiser la batterie.
