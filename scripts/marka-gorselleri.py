#!/usr/bin/env python3
"""#136 KK7: logo (iki nokta + kesik çizgili gülümseme, kanvas Tur 4 · 1) → uygulama ikonu, Android adaptive katmanları,
splash görseli ve favicon. Çalıştırma: python3 scripts/marka-gorselleri.py  (Pillow gerekir). Çıktı: assets/images/.
Gece zemin #152A6B; ikonda ikinci nokta beyaz; 24 px altında (favicon) çizgi kesiksiz."""
from pathlib import Path

from PIL import Image, ImageDraw

GECE = (0x15, 0x2A, 0x6B, 255)
MANDALINA = (0xFF, 0x7A, 0x1A, 255)
BEYAZ = (255, 255, 255, 255)
SEFFAF = (0, 0, 0, 0)
KOK = Path(__file__).resolve().parent.parent / 'assets' / 'images'

# Logo görünüm alanı 80 × 48 (kanvas): noktalar (24,14) ve (56,14) r 7; gülümseme M20 30 Q40 48 60 30, kalınlık 7, kesik 7/4,5.


def bezier(t):
    x = (1 - t) ** 2 * 20 + 2 * (1 - t) * t * 40 + t**2 * 60
    y = (1 - t) ** 2 * 30 + 2 * (1 - t) * t * 48 + t**2 * 30
    return x, y


def egri_noktalari(n=400):
    pts = [bezier(i / n) for i in range(n + 1)]
    uz = [0.0]
    for a, b in zip(pts, pts[1:]):
        uz.append(uz[-1] + ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5)
    return pts, uz


def logo_ciz(ciz, ox, oy, olcek, ikinci=GECE, kesik=True, ss=1):
    """ciz: ImageDraw; (ox, oy) sol üst; olcek = px / görünüm birimi; ss = süper örnekleme katsayısı (koordinatlar zaten çarpılmış)."""
    k = olcek * ss
    def P(x, y):
        return (ox * ss + x * k, oy * ss + y * k)
    r = 7 * k
    for cx, renk_ in ((24, MANDALINA), (56, ikinci)):
        x, y = P(cx, 14)
        ciz.ellipse((x - r, y - r, x + r, y + r), fill=renk_)
    pts, uz = egri_noktalari()
    kal = 7 * k
    toplam = uz[-1]
    parcalar = []
    if kesik:
        d, bos, s = 7.0, 4.5, 0.0
        while s < toplam:
            parcalar.append((s, min(s + d, toplam)))
            s += d + bos
    else:
        parcalar.append((0, toplam))
    def nokta(s):
        for i in range(1, len(uz)):
            if uz[i] >= s:
                t0 = (s - uz[i - 1]) / max(uz[i] - uz[i - 1], 1e-9)
                a, b = pts[i - 1], pts[i]
                return (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
        return pts[-1]
    for bas, son in parcalar:
        # Kesik = şerit çokgeni (sol/sağ kenar); çok noktalı kalın çizgi yerine temiz düz uçlar.
        orta = []
        s = bas
        while s < son:
            orta.append(nokta(s))
            s += 0.2
        orta.append(nokta(son))
        sol, sag = [], []
        for i, (x, y) in enumerate(orta):
            a = orta[max(i - 1, 0)]
            b = orta[min(i + 1, len(orta) - 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            uzun = (dx * dx + dy * dy) ** 0.5 or 1
            nx, ny = -dy / uzun * 3.5, dx / uzun * 3.5
            sol.append(P(x + nx, y + ny))
            sag.append(P(x - nx, y - ny))
        ciz.polygon(sol + sag[::-1], fill=MANDALINA)
        if not kesik:
            for x, y in (P(*orta[0]), P(*orta[-1])):
                ciz.ellipse((x - kal / 2, y - kal / 2, x + kal / 2, y + kal / 2), fill=MANDALINA)


def tuval(w, h, zemin, ss=4):
    im = Image.new('RGBA', (w * ss, h * ss), zemin)
    return im, ImageDraw.Draw(im), ss


def bitir(im, ss, yol):
    im = im.resize((im.width // ss, im.height // ss), Image.LANCZOS)
    im.save(yol)
    print(yol.name, im.size)


def logo_merkezli(w, h, zemin, genislik_orani, ikinci, kesik=True, yol=None):
    im, ciz, ss = tuval(w, h, zemin)
    lw = w * genislik_orani
    olcek = lw / 80
    lh = 48 * olcek
    logo_ciz(ciz, (w - lw) / 2, (h - lh) / 2 + 2 * olcek, olcek, ikinci=ikinci, kesik=kesik, ss=ss)
    bitir(im, ss, yol)


KOK.mkdir(parents=True, exist_ok=True)
# Uygulama ikonu 1024: Gece zemin, logo ~%62 genişlik, ikinci nokta beyaz.
logo_merkezli(1024, 1024, GECE, 0.62, BEYAZ, yol=KOK / 'icon.png')
# Android adaptive: ön katman saydam 512 (güvenli alan ~%66 → logo %44), arka Gece, monokrom beyaz 432.
logo_merkezli(512, 512, SEFFAF, 0.44, BEYAZ, yol=KOK / 'android-icon-foreground.png')
Image.new('RGBA', (512, 512), GECE).save(KOK / 'android-icon-background.png')
im, ciz, ss = tuval(432, 432, SEFFAF)
lw = 432 * 0.5
olcek = lw / 80
logo_ciz(ciz, (432 - lw) / 2, (432 - 48 * olcek) / 2 + 2 * olcek, olcek, ikinci=BEYAZ, ss=ss)
# monokrom: tek renk — Mandalina parçaları da beyaza çevrilir
mono = im.resize((432, 432), Image.LANCZOS)
px = mono.load()
for yy in range(432):
    for xx in range(432):
        r_, g_, b_, a_ = px[xx, yy]
        if a_:
            px[xx, yy] = (255, 255, 255, a_)
mono.save(KOK / 'android-icon-monochrome.png')
print('android-icon-monochrome.png', mono.size)
# Splash: saydam zeminde beyaz-Mandalina logo (expo-splash-screen zemin rengi Gece), 480 × 288 (120 px genişlikte 4x).
logo_merkezli(480, 288, SEFFAF, 0.9, BEYAZ, yol=KOK / 'splash-icon.png')
# Favicon 48: Gece zemin, kesiksiz çizgi (24 px altı kuralı; tarayıcı 16–32 px gösterir).
logo_merkezli(48, 48, GECE, 0.78, BEYAZ, kesik=False, yol=KOK / 'favicon.png')
