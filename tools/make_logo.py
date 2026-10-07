"""Logo « coche + IGH » : génère toutes les images de l'appli à partir d'un seul dessin.

Usage : python3 tools/make_logo.py        (Pillow + fontTools requis)

Produit :
  www/icon.svg                                       logo vectoriel (en-tête de l'accueil)
  www/logo.png                                       logo du PDF (en-tête) et de l'accueil
  android/.../mipmap-*/ic_launcher*.png              icône de l'appli (normale, ronde, adaptative)
  android/.../drawable*/splash.png                   écran de démarrage
  android/.../drawable-*/ic_stat_ronde.png           petite icône des notifications (blanche)
Police : Barlow Condensed Bold (licence OFL, tools/OFL-Barlow.txt).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
FONT = str(ROOT / "tools/BarlowCondensed-Bold.ttf")

FOND = (36, 51, 61, 255)      # acier #24333D
VERT = (52, 181, 110, 255)    # vert évacuation éclairci #34B56E (lisible sur fond sombre)
BLANC = (255, 255, 255, 255)

# Dessin dans un repère 512 x 512 : coche en haut, « IGH » en dessous.
CHECK = [(170, 128), (228, 186), (344, 70)]   # points de la coche
CHECK_W = 46                                  # épaisseur du trait
TEXTE = "IGH"
TEXTE_H = 190                                 # hauteur des capitales
TEXTE_BAS = 452                               # ligne de base


def dessine(img, x0, y0, taille, coche=VERT, texte=BLANC):
    """Dessine le logo dans le carré (x0, y0, taille) de l'image."""
    k = taille / 512
    d = ImageDraw.Draw(img)
    pts = [(x0 + x * k, y0 + y * k) for x, y in CHECK]
    w = max(2, round(CHECK_W * k))
    d.line(pts, fill=coche, width=w, joint="curve")
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=coche)
    # taille de police telle que la hauteur des capitales = TEXTE_H
    f = ImageFont.truetype(FONT, 100)
    cap = f.getbbox("H")[3] - f.getbbox("H")[1]
    f = ImageFont.truetype(FONT, max(6, round(100 * TEXTE_H * k / cap)))
    bb = d.textbbox((0, 0), TEXTE, font=f, anchor="ls")
    d.text((x0 + 256 * k - (bb[0] + bb[2]) / 2, y0 + TEXTE_BAS * k), TEXTE, font=f, fill=texte, anchor="ls")


def rendu(n, fond="carre", echelle=1.0, coche=VERT, texte=BLANC, transparent=False):
    """Image n x n : fond carré arrondi, rond ou transparent ; logo à `echelle` de la taille."""
    s = n * 4                                   # rendu 4x puis réduction : bords lissés
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if not transparent:
        if fond == "rond":
            d.ellipse([0, 0, s - 1, s - 1], fill=FOND)
        else:
            d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 96 / 512, fill=FOND)
    t = s * echelle
    dessine(im, (s - t) / 2, (s - t) / 2, t, coche, texte)
    return im.resize((n, n), Image.LANCZOS)


def svg():
    """Version vectorielle (texte converti en tracés, aucune police requise)."""
    font = TTFont(FONT)
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    upm = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight or 700
    sc = TEXTE_H / cap
    largeur = sum(gs[cmap[ord(c)]].width for c in TEXTE) * sc
    x, paths = 256 - largeur / 2, []
    for c in TEXTE:
        g = gs[cmap[ord(c)]]
        pen = SVGPathPen(gs)
        g.draw(TransformPen(pen, (sc, 0, 0, -sc, x, TEXTE_BAS)))
        paths.append(pen.getCommands())
        x += g.width * sc
    pts = " ".join(f"{a},{b}" for a, b in CHECK)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
            f'<rect width="512" height="512" rx="96" fill="#24333D"/>'
            f'<polyline points="{pts}" fill="none" stroke="#34B56E" stroke-width="{CHECK_W}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{" ".join(paths)}" fill="#FFFFFF"/></svg>')


if __name__ == "__main__":
    www = ROOT / "www"
    (www / "icon.svg").write_text(svg())
    rendu(600).save(www / "logo.png")

    for f in RES.glob("mipmap-*/ic_launcher.png"):
        n = Image.open(f).size[0]
        rendu(n, echelle=0.86).save(f)
    for f in RES.glob("mipmap-*/ic_launcher_round.png"):
        n = Image.open(f).size[0]
        rendu(n, fond="rond", echelle=0.78).save(f)
    # icône adaptative : avant-plan transparent, logo dans la zone sûre (66/108 de la largeur)
    for f in RES.glob("mipmap-*/ic_launcher_foreground.png"):
        n = Image.open(f).size[0]
        rendu(n, echelle=66 / 108 * 0.95, transparent=True).save(f)
    (RES / "values/ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#24333D</color>\n</resources>\n')

    # écran de démarrage : fond uni + logo
    for f in RES.glob("drawable*/splash.png"):
        w, h = Image.open(f).size
        im = Image.new("RGBA", (w, h), FOND)
        t = round(min(w, h) * 0.42)
        logo = rendu(t, transparent=True)
        im.alpha_composite(logo, ((w - t) // 2, (h - t) // 2))
        im.convert("RGB").save(f)

    # notifications : silhouette blanche sur transparent (exigence Android)
    for dpi, n in (("mdpi", 24), ("hdpi", 36), ("xhdpi", 48), ("xxhdpi", 72), ("xxxhdpi", 96)):
        (RES / f"drawable-{dpi}").mkdir(exist_ok=True)
        rendu(n, echelle=1.12, coche=BLANC, texte=BLANC, transparent=True).save(RES / f"drawable-{dpi}/ic_stat_ronde.png")
    print("Logo généré.")
