"""Génère le « faux téléphone » utilisé par les tests en mode Android.

Il reproduit ce qu'Android injecte réellement dans la page de l'APK :
  1. window.Capacitor (variables globales) ;
  2. le vrai pont JavaScript de Capacitor (node_modules/@capacitor/android/.../native-bridge.js) ;
  3. la déclaration de chaque plugin, générée comme le fait Capacitor (JSExport.java), à partir
     des méthodes @PluginMethod lues dans le code source des plugins.
Les appels natifs sont interceptés par un faux « androidBridge » qui répond comme le ferait le téléphone
et les enregistre dans window.__calls (vérifiés par les tests).

Usage : python3 tests/harnais_android.py   (après npm ci) -> tests/.cache/android_inject.js
"""
import glob
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "tests/.cache/android_inject.js"
PLUGINS = {
    "App": "node_modules/@capacitor/app/android",
    "Filesystem": "node_modules/@capacitor/filesystem/android",
    "Share": "node_modules/@capacitor/share/android",
    "LocalNotifications": "node_modules/@capacitor/local-notifications/android",
    "Updater": "android/app/src/main/java/fr/tmh/ronde/latour/UpdaterPlugin.java",
}

FAUX_TELEPHONE = r"""
window.__calls = []; window.__listeners = {}; window.__canInstall = true;
window.androidBridge = { postMessage: function (s) {
  var c = JSON.parse(s);
  if (c.type === 'js.error') { __calls.push(['JSERROR', c.error.message]); return; }
  if (c.pluginId === 'Console') return;
  var o = c.options || {};
  __calls.push([c.pluginId, c.methodName, o.path || o.url || (o.files && o.files.map(function (f) { return f.split('/').pop(); }).join(', '))
    || (o.notifications && o.notifications.length) || o.eventName || null]);
  if (c.methodName === 'addListener') { __listeners[o.eventName] = c.callbackId; return; }
  var d = {};
  if (c.methodName === 'writeFile') d = { uri: 'file:///storage/emulated/0/' + (o.directory === 'DOCUMENTS' ? 'Documents/' : 'cache/') + o.path };
  if (/Permissions$/.test(c.methodName)) d = { display: 'granted' };
  if (c.methodName === 'getPending') d = { notifications: [] };
  if (c.methodName === 'schedule') d = { notifications: o.notifications.map(function (n) { return { id: n.id }; }) };
  if (c.methodName === 'getInfo') d = { name: 'Contrôle IGH', id: 'fr.tmh.ronde.latour', version: '1.0.11', build: '11' };
  if (c.methodName === 'canInstall') d = { allowed: window.__canInstall };
  if (c.callbackId !== '-1') setTimeout(function () {
    Capacitor.fromNative({ callbackId: c.callbackId, pluginId: c.pluginId, methodName: c.methodName, success: true, data: d });
  }, 5);
} };
window.__pressBack = function () {
  Capacitor.fromNative({ callbackId: __listeners.backButton, pluginId: 'App', methodName: 'addListener', success: true, data: { canGoBack: false } });
};
"""


def methodes(chemin):
    fichiers = [chemin] if chemin.endswith(".java") else glob.glob(chemin + "/**/*.java", recursive=True) + glob.glob(chemin + "/**/*.kt", recursive=True)
    res = set()
    for f in fichiers:
        txt = (RACINE / f).read_text() if not Path(f).is_absolute() else Path(f).read_text()
        for m in re.finditer(r"@PluginMethod(\([^)]*\))?\s*(?:public\s+|override\s+)?(?:void|fun)\s+(\w+)", txt):
            res.add((m.group(2), "none" if m.group(1) and "RETURN_NONE" in m.group(1) else "promise"))
    return res


def main():
    lignes, entetes = [], []
    for nom, chemin in PLUGINS.items():
        meth = methodes(chemin) if chemin.endswith(".java") else methodes(str(RACINE / chemin))
        if nom != "Updater":
            meth |= {("checkPermissions", "promise"), ("requestPermissions", "promise")}
        lignes.append("(function(w){var a=(w.Capacitor=w.Capacitor||{});var p=(a.Plugins=a.Plugins||{});var t=(p['%s']={});"
                      "t.addListener=function(e,cb){return w.Capacitor.addListener('%s',e,cb)};" % (nom, nom))
        for m, rt in sorted(meth):
            if m in ("addListener", "removeListener"):
                continue
            fn = "nativePromise" if rt == "promise" else "nativeCallback"
            lignes.append("t['%s']=function(o){return w.Capacitor.%s('%s','%s',o)};" % (m, fn, nom, m))
        lignes.append("})(window);")
        entetes.append({"name": nom, "methods": [{"name": m, "rtype": rt} for m, rt in sorted(meth)]})
    pont = (RACINE / "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js").read_text()
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(FAUX_TELEPHONE + "\nwindow.Capacitor={DEBUG:true,isLoggingEnabled:false,Plugins:{}};\n" + pont + "\n"
                      + "\n".join(lignes) + "\nwindow.Capacitor.PluginHeaders=" + json.dumps(entetes) + ";")
    return SORTIE


if __name__ == "__main__":
    print("Faux téléphone généré :", main())
