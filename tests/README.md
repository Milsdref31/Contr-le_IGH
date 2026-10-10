# Tests automatisés

Un seul script joue tous les scénarios de bout en bout, en deux modes :

- **navigateur** : l'application telle qu'elle s'ouvre sur un ordinateur ;
- **android** : la même page avec le **vrai pont Capacitor** (`native-bridge.js`) et un faux téléphone
  (`harnais_android.py`) qui répond aux appels natifs comme l'APK et les enregistre pour vérification.

Aucune donnée réelle : agent « Agent test », photo = logo de l'application, serveur GitHub simulé.

## Lancer les tests

```bash
npm ci                                  # dépendances Capacitor (le faux téléphone lit leur code)
pip install playwright && playwright install chromium
python3 tests/test_application.py       # code de sortie 0 si tout passe
```

## Ce qui est vérifié (39 contrôles)

| Domaine | Vérifications |
|---|---|
| Parcours | nom d'agent obligatoire, ordre R+18 → RDC → Hall, 345 points par entrée |
| Enregistrement automatique | reprise après fermeture pendant la saisie d'une anomalie, photo comprise |
| Clôture | signature obligatoire, signature compressée, clôture incomplète avec motif obligatoire |
| Suivi des anomalies | commentaire daté avec auteur, levée, archivage |
| Exports | PDF, CSV de 345 lignes, photo renommée `date_entrée_étage_équipement.jpg` et jointe au même envoi |
| Sauvegarde | restauration sur un appareil vierge, fichier piégé neutralisé (aucun code exécuté), fichier invalide refusé |
| Stockage | alerte affichée au-delà de 60 % d'occupation |
| Android | enregistrement dans `Documents/Contrôle IGH/`, partage, bouton retour, mise à jour (autorisation, sauvegarde de sécurité, téléchargement), calendrier des rappels |

## Ce qui n'est pas couvert

Le comportement réel d'un téléphone physique : affichage des notifications, installateur Android,
capacité exacte du stockage. Une recette manuelle sur deux téléphones reste nécessaire avant la mise en service.
