# Contrôle IGH — Ronde de sécurité « LA TOUR »

Application de ronde hebdomadaire de sécurité de l'IGH « LA TOUR » :
Conforme / Non conforme pour chaque point, fiche anomalie avec photo, clôture bloquée tant qu'il manque un contrôle,
historique, suivi des anomalies, export PDF et CSV.

Trois rondes indépendantes, choisies depuis l'accueil (chacune a sa clôture, son PDF, son historique) :

| Ronde | Parcours | Points |
|---|---|---|
| Entrée n°1 | Hall → R+18 … RDC → Centrale de désenfumage (SSI) | 345 |
| Entrée n°3 | idem | 345 |
| Général | Extérieur → Toiture-terrasse | 14 |

Fichiers : `AAAA-MM-JJ_Ronde_LA-TOUR_Entree-1.pdf` (ou `Entree-3`, `General`).

Une seule base de code, deux façons de l'utiliser :

| | Appli web (Netlify) | APK Android |
|---|---|---|
| Source | dossier `www/` | `www/` emballé par Capacitor (`android/`) |
| Installation | « Ajouter à l'écran d'accueil » | fichier `.apk` depuis l'onglet **Releases** |
| Export PDF / CSV | partage ou téléchargement | enregistré dans `Documents/Ronde LA TOUR/AAAA-MM-JJ/`, puis menu de partage |
| Bouton retour du téléphone | — | revient à l'écran précédent |

Les données restent sur le téléphone (aucun serveur). Désinstaller l'APK efface l'historique : exportez avant.

## Organisation

```
www/                  appli (HTML/JS, sans build)
  index.html          écrans + CATALOGUE des points (en tête du script) + ordre de la ronde
  pdf.js              mise en page du PDF
  native.js           pont Android (fichiers, partage, bouton retour) — inactif dans un navigateur
  logo.png            (facultatif) logo affiché en haut à droite du PDF
android/              projet Android généré par Capacitor (icônes, manifeste, signature)
tools/make_icons.py   régénère icônes et écran de démarrage
.github/workflows/apk.yml   construit l'APK à chaque envoi sur main
```

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
