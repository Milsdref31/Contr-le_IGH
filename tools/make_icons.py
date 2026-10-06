"""Génère les icônes Android et l'écran de démarrage à partir du motif de www/icon.svg
(fond #14364a + coche blanche). Usage : python3 tools/make_icons.py  (Pillow requis)."""
import glob
from pathlib import Path
from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"
BG = (20, 54, 74, 255)
# Coche de icon.svg, repère 512 : (150,270) -> (220,340) -> (365,180), épaisseur 52
CHECK = [(150, 270), (220, 340), (365, 180)]


def draw_check(img, cx, cy, size):
    """Dessine la coche centrée en (cx, cy), dans une boîte de `size` px (repère 512)."""
    d = ImageDraw.Draw(img)
    k = size / 512
    ox, oy = cx - 257 * k, cy - 260 * k  # centre visuel de la coche
    pts = [(ox + x * k, oy + y * k) for x, y in CHECK]
    w = max(2, round(52 * k))
    d.line(pts, fill="white", width=w, joint="curve")
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill="white")


def big(n):  # rendu 4x puis réduction = bords lissés
    return Image.new("RGBA", (n * 4, n * 4), (0, 0, 0, 0))


def save(img, n, path):
    img.resize((n, n), Image.LANCZOS).save(path)


for f in glob.glob(str(RES / "mipmap-*/ic_launcher.png")):
    n = Image.open(f).size[0]
    im = big(n)
    ImageDraw.Draw(im).rounded_rectangle([0, 0, n * 4 - 1, n * 4 - 1], radius=n * 4 * 96 / 512, fill=BG)
    draw_check(im, n * 2, n * 2, n * 4)
    save(im, n, f)

for f in glob.glob(str(RES / "mipmap-*/ic_launcher_round.png")):
    n = Image.open(f).size[0]
    im = big(n)
    ImageDraw.Draw(im).ellipse([0, 0, n * 4 - 1, n * 4 - 1], fill=BG)
    draw_check(im, n * 2, n * 2, n * 4 * 0.85)
    save(im, n, f)

# Icône adaptative : avant-plan transparent, coche dans la zone sûre (66/108)
for f in glob.glob(str(RES / "mipmap-*/ic_launcher_foreground.png")):
    n = Image.open(f).size[0]
    im = big(n)
    draw_check(im, n * 2, n * 2, n * 4 * 66 / 108 * 0.9)
    save(im, n, f)

# Écran de démarrage : fond uni + coche
for f in glob.glob(str(RES / "drawable*/splash.png")):
    w, h = Image.open(f).size
    im = Image.new("RGBA", (w, h), BG)
    draw_check(im, w / 2, h / 2, min(w, h) * 0.35)
    im.convert("RGB").save(f)

(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#14364A</color>\n</resources>\n')
print("Icônes et splash générés.")
