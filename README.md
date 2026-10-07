# Contrôle IGH — Ronde de sécurité « LA TOUR »

Application de ronde hebdomadaire de sécurité d'un IGH :
Conforme / Non conforme pour chaque point, fiche anomalie avec photo, clôture bloquée tant qu'il manque un contrôle,
historique, suivi des anomalies, export PDF et CSV.

Trois rondes indépendantes, choisies depuis l'accueil (chacune a sa clôture, son PDF, son historique) :

| Ronde | Parcours | Points |
|---|---|---|
| Entrée n°1 | R+18 … R+1 → RDC (+ centrale SSI) → Hall | 345 |
| Entrée n°3 | R+18 … R+1 (+ centrale SSI) → RDC → Hall | 345 |
| Général | Extérieur → Toiture-terrasse | 14 |

Fichiers : `AAAA-MM-JJ_Ronde_LA-TOUR_Entree-1.pdf` (ou `Entree-3`, `General`).

Une seule base de code, deux façons de l'utiliser :

|  | APK Android |
|---|---|---|
| Source | dossier `www/` | `www/` emballé par Capacitor (`android/`) |
| Installation | « Ajouter à l'écran d'accueil » | fichier `.apk` depuis l'onglet **Releases** |
| Export PDF / CSV | partage ou téléchargement | enregistré dans `Documents/Ronde LA TOUR/AAAA-MM-JJ/`, puis menu de partage |
| Bouton retour du téléphone | — | revient à l'écran précédent |

Les données restent sur le téléphone (aucun serveur). Désinstaller l'APK efface l'historique : exportez avant.

## Organisation

```
www/                  appli (HTML/CSS/JS, sans build)
  index.html          page unique, charge les scripts dans l'ordre
  catalogue.js        POINTS DE CONTRÔLE, niveaux, entrées, ordre des rondes  <- à modifier ici
  app.js              écrans, actions, stockage, exports
  style.css           mise en forme (couleurs signalétique sécurité, police Barlow)
  pdf.js              mise en page du rapport PDF
  native.js           pont Android (fichiers, partage, bouton retour) — inactif dans un navigateur
  fonts/              police Barlow (licence OFL) embarquée pour le hors-ligne
  icon.svg, logo.png  logo « coche + IGH » (accueil, PDF) — généré par tools/make_logo.py
android/              projet Android généré par Capacitor (icônes, manifeste, signature)
tools/make_logo.py    dessine le logo et régénère toutes les icônes (appli, web, notifications, démarrage)
.github/workflows/apk.yml   construit l'APK à chaque envoi sur main
```

Règles de la ronde :
- chaque point reçoit Conforme ou Non conforme (observation obligatoire, photo facultative) ;
- « Tout mettre conforme » ne remplit que les points sans réponse et les marque « validé en bloc » ;
- clôture normale quand tous les points ont une réponse ; sinon « Clôturer quand même » exige un motif
  et la ronde est marquée **incomplète** (écran, PDF) ;
- le suivi d'une anomalie (À traiter / En cours / Levée) garde la date de chaque changement.
- **enregistrement automatique** : chaque réponse, la fiche anomalie en cours de saisie (texte et photo) et l'écran
  affiché sont enregistrés en continu ; en rouvrant l'appli on revient exactement où on en était ;
- **rappels (APK)** : notification du lundi au vendredi vers 8 h 30 tant que les 3 rondes de la semaine
  (Entrée n°1, Entrée n°3, Général) ne sont pas clôturées. Heure et jours réglables dans `catalogue.js` (`RAPPEL`).
  Une ronde compte pour la semaine où elle a été commencée (semaine du lundi au dimanche).
  La version web (iPhone) n'a pas de notification : le bandeau de l'accueil indique les contrôles restants.

## Obtenir l'APK

1. Modifier `www/` puis envoyer sur `main` (ou onglet **Actions › APK Android › Run workflow**).
2. Après ~5 min, l'APK apparaît dans **Releases** (`Ronde-LA-TOUR-v1.0.N.apk`).
3. Sur le téléphone : télécharger, ouvrir, autoriser l'installation depuis cette source.

Les mises à jour s'installent par-dessus la version précédente **à condition d'être signées avec la même clé** (voir ci-dessous).

## Signature (à faire une fois)

Dans **Settings › Secrets and variables › Actions › New repository secret**, créer :

| Nom | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contenu du fichier `keystore-base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe de la clé |
| `ANDROID_KEY_PASSWORD` | même mot de passe |
| `ANDROID_KEY_ALIAS` | `ronde` |

Sans ces secrets, le build produit un APK marqué **-TEST** signé avec une clé jetable : il ne pourra pas être mis à jour
sans désinstallation (donc perte des données). Conserver le fichier `.jks` et son mot de passe en lieu sûr :
une clé perdue empêche toute mise à jour.

## Développement local (facultatif)

Prérequis : Node 22+, JDK 21, Android SDK.

```
npm ci
npm run apk:debug        # => android/app/build/outputs/apk/debug/app-debug.apk
```

Après modification de `www/`, `npx cap sync android` recopie l'appli dans le projet Android.
Pour Netlify : glisser le dossier `www/` sur app.netlify.com/drop.
