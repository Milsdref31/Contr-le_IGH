"""Tests automatisés de bout en bout de l'application Contrôle IGH.

Chaque scénario est joué deux fois :
  - mode « navigateur » : l'application telle qu'elle s'ouvre sur un ordinateur ;
  - mode « android »    : la même page avec le vrai pont Capacitor et un faux téléphone
                          (voir tests/harnais_android.py), comme dans l'APK.
Aucune donnée réelle : agent « Agent test », photo = logo de l'application, GitHub simulé.

Prérequis : Python 3, `pip install playwright`, Chromium (`playwright install chromium`), `npm ci`.
Usage     : python3 tests/test_application.py          -> résumé, code de sortie 0 si tout passe
"""
import csv
import functools
import http.server
import io
import json
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harnais_android  # noqa: E402

RACINE = Path(__file__).resolve().parent.parent
WWW = RACINE / "www"
PHOTO = WWW / "logo.png"
VERSION_SIMULEE = {"tag_name": "v1.0.99", "published_at": "2026-10-10T08:00:00Z",
                   "assets": [{"name": "Controle-IGH-v1.0.99.apk",
                               "browser_download_url": "https://github.com/exemple/depot/releases/download/v1.0.99/Controle-IGH-v1.0.99.apk"}]}
RESULTATS = []


def verifier(mode, nom, condition, detail=""):
    RESULTATS.append((mode, nom, bool(condition), detail))


class Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serveur():
    gestion = functools.partial(Silencieux, directory=str(WWW))
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), gestion)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, "http://127.0.0.1:%d/index.html" % s.server_address[1]


def nouvelle_page(navigateur, url, android, horloge=None):
    ctx = navigateur.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
    pg = ctx.new_page()
    pg.erreurs, pg.dialogues = [], []
    pg.on("pageerror", lambda e: pg.erreurs.append(str(e)))
    pg.on("dialog", lambda d: (pg.dialogues.append(d.message), d.accept()))
    pg.route("https://api.github.com/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(VERSION_SIMULEE)))
    if horloge:
        pg.clock.install(time=horloge)
    if android:
        pg.add_init_script(harnais_android.SORTIE.read_text())
    pg.goto(url)
    pg.wait_for_timeout(500)
    return ctx, pg


def signer(pg):
    zone = pg.locator("#sig").bounding_box()
    pg.mouse.move(zone["x"] + 30, zone["y"] + 110)
    pg.mouse.down()
    for i in range(1, 12):
        pg.mouse.move(zone["x"] + 30 + i * 22, zone["y"] + 110 - (i % 3) * 30)
    pg.mouse.up()


def tout_conforme(pg):
    for sid in pg.evaluate("stationsDe(cur()).map(s => s.id)"):
        pg.evaluate("id => { V = { s: 'st', id }; render(); }", sid)
        if pg.locator("[data-a=all]").count():
            pg.click("[data-a=all]")


def scenarios(navigateur, url, mode):
    android = mode == "android"
    ctx, pg = nouvelle_page(navigateur, url, android)

    # 1. Nom de l'agent obligatoire (Paramètres)
    pg.click("[data-a=new][data-t=e1]")
    verifier(mode, "Sans nom d'agent, l'appli ouvre les Paramètres", pg.evaluate("V.s") == "param")
    pg.fill("#ag", "Agent test")

    # 2. Ronde Entrée n°1 avec deux anomalies, dont une avec photo
    pg.evaluate("V = { s: 'home' }; render()")
    pg.click("[data-a=new][data-t=e1]")
    verifier(mode, "Parcours Entrée n°1 : 345 points, R+18 en premier, hall en dernier",
             pg.evaluate("[cnt(cur()).t, stationsDe(cur())[0].court, stationsDe(cur()).slice(-1)[0].court].join()") == "345,R+18,Hall")
    pg.evaluate("V = { s: 'st', id: 'e1-R+12' }; render()")
    pg.locator("[data-a=nc]").nth(3).click()
    pg.fill("#com", "Porte coupe-feu : le battant ne se referme pas")
    pg.set_input_files("#ph", str(PHOTO))
    pg.wait_for_timeout(700)

    # 3. Enregistrement automatique : fermeture pendant la saisie de l'anomalie
    pg.reload()
    pg.wait_for_timeout(500)
    verifier(mode, "Reprise après fermeture : même écran, fiche anomalie et photo conservées",
             pg.evaluate("V.s") == "st" and pg.locator("#com").count() and "battant" in pg.input_value("#com") and pg.locator("#pv img").count() == 1)
    pg.click("[data-a=save]")
    pg.evaluate("V = { s: 'st', id: 'e1-hall' }; render()")
    pg.locator("[data-a=nc]").first.click()
    pg.fill("#com", "Encombrant dans le hall")
    pg.click("[data-a=save]")
    tout_conforme(pg)

    # 4. Clôture : signature obligatoire
    pg.evaluate("V = { s: 'recap' }; render()")
    pg.click("[data-a=fin]")
    pg.click("[data-a=signOk]")
    verifier(mode, "Clôture refusée sans signature", pg.evaluate("cur() && cur().statut") == "en cours")
    signer(pg)
    pg.click("[data-a=signOk]")
    pg.wait_for_timeout(300)
    r = pg.evaluate("DB.rondes[0]")
    verifier(mode, "Ronde clôturée et signée par l'agent", r["statut"] == "clôturée" and r.get("signature", {}).get("nom") == "Agent test")
    verifier(mode, "Signature compressée (moins de 30 000 caractères)", len(r["signature"]["img"]) < 30000, "%d caractères" % len(r["signature"]["img"]))
    rid = r["id"]

    # 5. Suivi : commentaire, levée, archivage, désarchivage
    pg.evaluate("V = { s: 'anom' }; F.anomStatut = 'open'; render()")
    pg.locator(".ano textarea").first.fill("Devis demandé au mainteneur")
    pg.locator("[data-a=addCom]").first.click()
    verifier(mode, "Commentaire de suivi enregistré avec l'auteur",
             pg.evaluate("Object.values(DB.rondes[0].r).some(x => x.coms && x.coms[0].auteur === 'Agent test')"))
    pg.locator('.seg button[data-v="Levée"]').first.click()
    pg.evaluate("F.anomStatut = 'done'; render()")
    pg.locator("[data-a=archiver]").first.click()
    compte = {k: pg.evaluate("k => { F.anomStatut = k; render(); return document.querySelectorAll('.ano').length; }", k) for k in ("open", "done", "arch")}
    verifier(mode, "Archivage : l'anomalie levée passe dans « Archivées »", compte == {"open": 1, "done": 0, "arch": 1}, str(compte))

    # 6. Ronde Général clôturée incomplète : motif puis signature
    pg.evaluate("V = { s: 'home' }; render()")
    pg.click("[data-a=new][data-t=g]")
    pg.evaluate("V = { s: 'recap' }; render()")
    pg.click("[data-a=closeForm]")
    pg.click("[data-a=finForce]")
    verifier(mode, "Clôture incomplète refusée sans motif", pg.evaluate("cur().statut") == "en cours")
    pg.fill("#motif", "Accès toiture fermé")
    pg.click("[data-a=finForce]")
    signer(pg)
    pg.click("[data-a=signOk]")
    g = pg.evaluate("DB.rondes.find(r => r.type === 'g')")
    verifier(mode, "Ronde incomplète clôturée, signée, marquée incomplète", g["statut"] == "clôturée" and g.get("incomplete") and g.get("signature"))

    # 7. Exports
    if android:
        pg.evaluate("__calls.length = 0")
        pg.evaluate("id => exportCSV(byId(id))", rid)
        pg.wait_for_timeout(1500)
        partage = [c for c in pg.evaluate("__calls") if c[0] == "Share"]
        verifier(mode, "CSV et photo renommée partagés ensemble",
                 partage and "2026" in partage[0][2] and "_Entree-1_R+12_Portes-coupe-feu-4.1.jpg" in partage[0][2], str(partage))
        pg.evaluate("__calls.length = 0")
        pg.evaluate("id => exportPDF(byId(id))", rid)
        pg.wait_for_timeout(1500)
        ecrit = [c for c in pg.evaluate("__calls") if c[1] == "writeFile"]
        verifier(mode, "PDF enregistré dans Documents/Contrôle IGH/<date>/", ecrit and ecrit[0][2].startswith("Contrôle IGH/") and ecrit[0][2].endswith("_Entree-1.pdf"), str(ecrit))
    else:
        fichiers = []
        pg.on("download", lambda d: fichiers.append(d))
        pg.evaluate("id => exportCSV(byId(id))", rid)
        pg.wait_for_timeout(1500)
        noms = [d.suggested_filename for d in fichiers]
        photo = [n for n in noms if n.endswith(".jpg")]
        verifier(mode, "CSV + photo téléchargés, photo nommée date_entrée_étage_équipement", len(noms) == 2 and photo and "_Entree-1_R+12_Portes-coupe-feu-4.1.jpg" in photo[0], str(noms))
        lignes = list(csv.reader(io.StringIO(Path(fichiers[0].path()).read_text(encoding="utf-8-sig")), delimiter=";"))
        verifier(mode, "CSV : 345 lignes, colonne « Fichier photo » renseignée",
                 len(lignes) == 346 and any(l[13] == photo[0] for l in lignes[1:]) if photo else False)
        with pg.expect_download() as d:
            pg.evaluate("id => exportPDF(byId(id))", rid)
        verifier(mode, "PDF téléchargé", d.value.suggested_filename.endswith("_Entree-1.pdf"))

    # 8. Sauvegarde puis restauration sur un « téléphone » vierge
    if not android:
        with pg.expect_download() as d:
            pg.evaluate("exporterSauvegarde()")
        sauvegarde = Path(tempfile.mkdtemp()) / d.value.suggested_filename
        d.value.save_as(sauvegarde)
        ctx2, pg2 = nouvelle_page(navigateur, url, False)
        pg2.evaluate("V = { s: 'param' }; render()")
        pg2.set_input_files("#imp", str(sauvegarde))
        pg2.wait_for_timeout(600)
        verifier(mode, "Restauration sur téléphone vierge : rondes, agent, signature",
                 pg2.evaluate("[DB.rondes.length, DB.agent, !!DB.rondes[0].signature.img].join()") == "2,Agent test,true")
        # 9. Sauvegarde piégée : image remplacée par du code
        piege = json.loads(sauvegarde.read_text())
        piege["data"]["rondes"][0]["r"][next(iter(k for k, x in piege["data"]["rondes"][0]["r"].items() if x.get("ph")))]["ph"] = 'x" onerror="window.__INJECTION=1'
        fichier_piege = sauvegarde.with_name("piege.json")
        fichier_piege.write_text(json.dumps(piege))
        pg2.evaluate("V = { s: 'param' }; render()")
        pg2.set_input_files("#imp", str(fichier_piege))
        pg2.wait_for_timeout(600)
        pg2.evaluate("V = { s: 'anom' }; F.anomStatut = 'all'; render()")
        pg2.wait_for_timeout(400)
        verifier(mode, "Sauvegarde piégée : aucun code exécuté, image retirée",
                 not pg2.evaluate("!!window.__INJECTION") and any("image non valide" in m for m in pg2.dialogues))
        pg2.evaluate("V = { s: 'param' }; render()")
        pg2.set_input_files("#imp", str(PHOTO))
        pg2.wait_for_timeout(300)
        verifier(mode, "Fichier qui n'est pas une sauvegarde : refusé", any("illisible" in m for m in pg2.dialogues))
        verifier(mode, "Aucune erreur JavaScript (restauration)", not pg2.erreurs, str(pg2.erreurs))
        ctx2.close()

    # 10. Jauge de stockage et alerte au-delà de 60 %
    pg.evaluate("localStorage.setItem('remplissage_test', 'x'.repeat(3100000)); V = { s: 'home' }; render()")
    alerte = pg.locator("text=Mémoire de l’application occupée").count()
    pg.evaluate("localStorage.removeItem('remplissage_test'); render()")
    verifier(mode, "Alerte de mémoire affichée au-delà de 60 %", alerte >= 1)

    # 11. Mise à jour (mode Android)
    if android:
        pg.evaluate("V = { s: 'param' }; render()")
        pg.click("[data-a=majCheck]")
        pg.wait_for_timeout(800)
        verifier(mode, "Nouvelle version détectée", "v1.0.99" in pg.inner_text("#app"))
        pg.evaluate("__calls.length = 0")
        pg.click("[data-a=majInstall]")
        pg.wait_for_timeout(1500)
        appels = [c[1] for c in pg.evaluate("__calls") if c[0] in ("Updater", "Filesystem")]
        verifier(mode, "Installation : autorisation, sauvegarde de sécurité, téléchargement", appels == ["canInstall", "writeFile", "downloadAndInstall"], str(appels))
        pg.evaluate("V = { s: 'hist' }; render(); __pressBack()")
        verifier(mode, "Bouton retour Android : écran précédent", pg.evaluate("V.s") == "home")

    verifier(mode, "Aucune erreur JavaScript", not pg.erreurs, str(pg.erreurs))
    ctx.close()


def rappels(navigateur, url):
    """Calendrier des rappels (mode Android) : lundi-vendredi 8 h 30 tant que les 3 rondes ne sont pas faites."""
    cas = [("2026-10-06T07:00:00", [], 20), ("2026-10-06T10:00:00", ["e1", "e3"], 19), ("2026-10-07T09:00:00", ["e1", "e3", "g"], 17)]
    for horloge, faites, attendu in cas:
        ctx, pg = nouvelle_page(navigateur, url, True, horloge)
        pg.evaluate("DB.agent = 'Agent test'; save()")
        for t in faites:
            pg.click("[data-a=new][data-t=%s]" % t)
            tout_conforme(pg)
            pg.evaluate("V = { s: 'recap' }; render()")
            pg.click("[data-a=fin]")
            pg.evaluate("SIG.traits = 1")
            pg.click("[data-a=signOk]")
            pg.evaluate("V = { s: 'home' }; render()")
        pg.wait_for_timeout(300)
        prog = [c for c in pg.evaluate("__calls") if c[0] == "LocalNotifications" and c[1] == "schedule"]
        verifier("android", "Rappels %s, rondes faites %s : %d programmés" % (horloge[:10], faites or "aucune", attendu),
                 prog and prog[-1][2] == attendu, str(prog[-1] if prog else None))
        ctx.close()


def main():
    harnais_android.main()
    srv, url = serveur()
    with sync_playwright() as p:
        nav = p.chromium.launch()
        for mode in ("navigateur", "android"):
            scenarios(nav, url, mode)
        rappels(nav, url)
        nav.close()
    srv.shutdown()
    echecs = [r for r in RESULTATS if not r[2]]
    for mode, nom, ok, detail in RESULTATS:
        print(("OK    " if ok else "ÉCHEC ") + "[%s] %s%s" % (mode, nom, "" if ok else "  -> " + detail))
    print("\n%d vérifications, %d échec(s)." % (len(RESULTATS), len(echecs)))
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
