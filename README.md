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
| Signature électronique | Chaque ronde est signée au doigt par l'agent au moment de la clôture ; la signature figure à la fin du rapport PDF. |
| Traçabilité | Chaque réponse est horodatée. Le rapport indique le nom de l'agent, l'heure de début, de fin et la durée. |
| Clôture contrôlée | Une ronde ne se clôture normalement que si tous les points ont une réponse (voir [Règles](#règles-de-traçabilité)). |
| Rapports | Rapport **PDF** (synthèse, anomalies avec photos et commentaires, détail de tous les points, signature) et export **CSV** pour Excel, envoyé avec les photos des anomalies. |
| Suivi des anomalies | Statut *À traiter* → *En cours* → *Levée* (date de chaque changement), commentaires de suivi datés, archivage des anomalies levées. |
| Rappels | Notification du lundi au vendredi vers 8 h 30 tant que les 3 rondes de la semaine ne sont pas faites. |
| Enregistrement automatique | Tout est enregistré en continu. Si l'application est fermée, elle rouvre exactement là où l'on s'était arrêté. |
| Hors ligne | Aucun réseau nécessaire pendant la ronde. |
| Sauvegarde | Un fichier de sauvegarde unique (rondes, anomalies, photos, signatures) à créer et à restaurer depuis les Paramètres. |
| Mise à jour | Recherche et installation de la nouvelle version depuis l'application (Paramètres). |

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

1. **Première utilisation** : ouvrir les **Paramètres** (roue ⚙ en haut de l'accueil) et saisir son nom.
   **Accueil** : appuyer sur la ronde à faire.
2. **Parcours** : la liste des niveaux s'affiche. Le bouton vert « Continuer » ouvre le prochain niveau à contrôler.
3. **Niveau** : répondre à chaque point. En cas d'anomalie, remplir la fiche (observation, photo).
   Le bouton du bas passe au niveau suivant.
4. **Terminer la ronde** : vérifier le récapitulatif, appuyer sur « Clôturer la ronde », **signer au doigt**
   dans le cadre puis appuyer sur « Signer et clôturer ».
5. **Rapport** : le rapport s'affiche. « Exporter le rapport PDF » l'enregistre sur le téléphone et ouvre
   le menu de partage (messagerie, Teams…) pour l'envoyer au mandataire.

Une ronde interrompue reste « En cours » sur l'accueil : il suffit d'appuyer dessus pour la reprendre.

### Où trouver les rapports

- Dans l'application : **Rapports de ronde** (accueil), avec un bouton PDF par ronde.
- Sur le téléphone : dossier `Documents/Contrôle IGH/AAAA-MM-JJ/`
- Nom des fichiers : `AAAA-MM-JJ_Ronde_<bâtiment>_Entree-1.pdf` (ou `Entree-3`, `General`, et `.csv`).
  Le format année-mois-jour permet un classement chronologique automatique.
- **Export CSV et photos** : « Exporter le détail en CSV » joint au même envoi (mail, Teams…) le fichier CSV **et les
  photos des anomalies**. Chaque photo est renommée `date_entrée_étage_équipement.jpg`
  (ex. `2026-10-07_Entree-1_R+12_Portes-coupe-feu-4.1.jpg`) et ce nom figure dans la colonne « Fichier photo » du CSV.

### Suivi des anomalies

- Écran **Anomalies** (accueil) : filtres *Ouvertes*, *Levées*, *Archivées*, *Toutes*, et par ronde.
- Statut en un appui : *À traiter* → *En cours* → *Levée*. Chaque changement est daté.
- **Commentaires de suivi** : sous chaque anomalie, ajouter un commentaire (devis demandé, intervention prévue…).
  Il est enregistré avec la date, l'heure et le nom de l'agent, puis repris dans le PDF et le CSV.
- **Archivage** : une anomalie *Levée* peut être archivée ; elle quitte les listes courantes et reste consultable
  dans le filtre *Archivées* (désarchivage possible).

### Paramètres

- **Nom de l'agent** : enregistré sur chaque ronde, dans les rapports et avec la signature.
- **Créer une sauvegarde** : un fichier `AAAA-MM-JJ_Sauvegarde_Controle-IGH.json` contenant toutes les données
  (rondes, anomalies, photos, signatures), enregistré dans `Documents/Contrôle IGH/Sauvegardes/` et proposé au partage.
  À conserver hors du téléphone (messagerie, OneDrive…).
- **Restaurer une sauvegarde** : choisir le fichier ; après confirmation, il **remplace** les données de l'application
  (changement de téléphone, réinstallation).
- **Mise à jour** : « Rechercher une mise à jour » compare la version installée à la dernière version publiée ;
  « Installer la mise à jour » crée d'abord une sauvegarde, télécharge la nouvelle version puis ouvre l'installateur
  Android (confirmation demandée). La première fois, Android demande d'autoriser l'application à installer des mises à jour.
  Une mise à jour disponible est aussi signalée sur l'accueil (vérification une fois par jour).

### Règles de traçabilité

- Chaque point doit recevoir une réponse. Une observation est obligatoire pour toute non-conformité.
- « Tout mettre conforme » ne remplit que les points sans réponse ; ils sont marqués **« validé en bloc »**
  dans le rapport (astérisque) et dans le CSV.
- Clôture normale : uniquement quand tous les points ont une réponse.
- Clôture anticipée (« Clôturer quand même ») : un **motif est obligatoire** ; la ronde est marquée
  **« incomplète »** à l'écran et dans le PDF, et les points sans réponse y figurent comme « MANQUANT ».
- La clôture exige la **signature électronique** de l'agent (tracé au doigt), enregistrée avec son nom, la date et l'heure.
- Une ronde clôturée n'est plus modifiable. Seuls le suivi des anomalies (statut, commentaires, archivage) peut évoluer,
  et chaque action est datée.
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
│           Updater (propre à l'appli) mise à jour
│                                              │
│  Stockage : localStorage de la WebView       │
└──────────────────────────────────────────────┘
  Aucun serveur. Seul appel réseau : la recherche et le
  téléchargement d'une mise à jour (GitHub Releases).
```

- **Interface** : application web statique (HTML/CSS/JavaScript, sans framework ni étape de compilation),
  embarquée dans un APK par [Capacitor](https://capacitorjs.com/).
- **PDF** : généré sur le téléphone par la bibliothèque jsPDF.
- **Données** : objet JSON dans le `localStorage` de la WebView (clé `ronde_latour_v3`), enregistré à chaque action.
- **Réseau** : la ronde fonctionne entièrement hors ligne. Le seul échange réseau est la mise à jour : lecture de la
  dernière version publiée (`api.github.com`, dépôt réglé dans `catalogue.js`, `MISE_A_JOUR`) puis téléchargement de l'APK.
  Aucune donnée de ronde n'est envoyée.
- **Mise à jour** : plugin Android propre à l'application, `UpdaterPlugin.java` (téléchargement dans le cache puis
  ouverture de l'installateur Android, qui demande confirmation). Le numéro de version de l'APK (`versionCode`) est le
  numéro de compilation ; une version est proposée si le numéro de la dernière release est supérieur.

### Arborescence

```
www/                        application (seul dossier à modifier pour le fonctionnel)
  catalogue.js              ► nom du bâtiment, points de contrôle, niveaux, ordre des rondes, niveau de la SSI, heure des rappels
  app.js                    écrans, actions, enregistrement, exports CSV, calcul des rappels
  pdf.js                    mise en page du rapport PDF
  native.js                 liaison avec Android (fichiers, partage, retour, notifications, mise à jour)
  style.css                 mise en forme
  index.html                page unique, ordre de chargement des scripts
  jspdf.umd.min.js          bibliothèque jsPDF 4.2.1 (MIT)
  fonts/                    police Barlow (licence OFL) embarquée
  icon.svg, logo.png        logo (en-tête de l'accueil, en-tête du PDF)
android/                    projet Android (manifeste, icônes, signature) — généré par Capacitor
  app/src/main/java/…/UpdaterPlugin.java   plugin de mise à jour depuis l'application
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
| Données personnelles | Nom de l'agent, horodatages, photos d'anomalies, signature manuscrite (image), commentaires. Aucune donnée transmise automatiquement. |
| Accès par un tiers | **Uniquement si l'agent partage le rapport en PDF ou en CSV** (ou un fichier de sauvegarde), par le menu de partage Android. Il n'existe aucun autre moyen de consulter les données. |
| Réseau | Uniquement pour la mise à jour (`api.github.com` et téléchargement de l'APK). Aucune donnée de ronde n'est transmise. |
| Permissions Android | `POST_NOTIFICATIONS` (rappels) · `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` (rappels conservés après redémarrage) · `INTERNET` (mise à jour) · `REQUEST_INSTALL_PACKAGES` (installation de la mise à jour, confirmée par l'utilisateur) · `READ/WRITE_EXTERNAL_STORAGE` limitées à Android ≤ 10 (écriture dans `Documents`). |
| Sauvegarde | Fichier de sauvegarde créé à la demande par l'agent (Paramètres). Il contient toutes les données, photos et signatures comprises : à stocker sur un espace professionnel. Aucune sauvegarde centrale automatique ; les PDF exportés constituent la trace officielle. |
| Signature électronique | Image du tracé manuscrit, associée au nom de l'agent et à l'horodatage. Il s'agit d'une signature simple (pas de certificat qualifié au sens eIDAS). |
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
| Changer le dépôt utilisé pour les mises à jour | `www/catalogue.js`, `MISE_A_JOUR = { depot: 'propriétaire/dépôt' }` |
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
menu de partage (remplacé par des téléchargements), bouton retour, notifications et installation de mise à jour.

### Limites connues

- Pas de partage multi-utilisateurs ni de consultation à distance : chaque téléphone a son propre historique,
  consultable par un tiers uniquement via les PDF / CSV partagés par l'agent.
  Une évolution vers un stockage central (SharePoint / Microsoft Lists, serveur interne) est possible si le besoin apparaît.
- Les rappels sont « vers 8 h 30 » : Android peut décaler légèrement une alarme non exacte pour économiser la batterie.
- La mise à jour depuis l'application suppose : un dépôt **public** (ou une adaptation pour un dépôt privé),
  et des APK **signés avec la même clé** (voir Signature). Avec les versions `-TEST`, Android refuse l'installation
  par-dessus : il faut alors sauvegarder, désinstaller, installer puis restaurer la sauvegarde.
- Le stockage interne de la WebView est limité (quelques Mo) : les photos pèsent environ 100 Ko chacune.
  Créer régulièrement une sauvegarde.
