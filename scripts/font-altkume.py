#!/usr/bin/env python3
# #643 KK2: web fontları. @expo-google-fonts/figtree'nin TTF'lerinden (yalnız uygulamanın kullandığı 5 ağırlık; src/theme.ts
# `yazi`) woff2 alt kümeleri üretir: assets/fonts/figtree/*.woff2. Yalnız web bunları kullanır
# (src/components/kok/fontlar.web.ts); native TTF'leri kullanmaya devam eder (fontlar.ts).
# Alt küme: Latin-1, Latin Genişletilmiş-A (Türkçe ğĞşŞİı ve kullanıcı içeriğindeki Avrupa yer adları: Łódź, Staroměstské…),
# Romence ș ț, birleştirici işaretler (İ'nin küçük harfi i̇), genel noktalama (tipografik tırnaklar, …, –, —, •), para
# birimleri, ok ve birkaç matematik işareti. Figtree'de olmayan karakterler (ör. ₺, ★, ✓, ●) zaten sistem fontundan
# çizilir; alt küme bunu değiştirmez. Atılanlar: üst/alt simge rakamları, kesirler ve kullanılmayan OpenType özellikleri
# (stil setleri, `aalt`, `frac`, `sups`…). Tutulan özellikler: kerning, işaret konumlama, `locl` (Türkçe), `case`, `tnum`
# (PlanListesi saat sütunu), `pnum`.
# Gerekli: pip install fonttools brotli   ·   Kullanım: python3 scripts/font-altkume.py [--denetle]
# --denetle: dosyaları yeniden üretmeden tr.json'daki (fontta bulunan) her karakterin alt kümede olduğunu doğrular.
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

KOK = Path(__file__).resolve().parent.parent
KAYNAK = KOK / 'node_modules' / '@expo-google-fonts' / 'figtree'
HEDEF = KOK / 'assets' / 'fonts' / 'figtree'
AGIRLIKLAR = ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold']

ARALIKLAR = [
    (0x0000, 0x00FF),  # Basic Latin + Latin-1 (Ç Ö Ü ç ö ü â î û ©, ·, ×)
    (0x0100, 0x017F),  # Latin Genişletilmiş-A (Ğ ğ İ ı Ş ş; Ł ě ő …)
    (0x0218, 0x021B),  # Ș ș Ț ț
    (0x02C6, 0x02DD),  # aralıklı aksanlar
    (0x0300, 0x0328),  # birleştirici işaretler (i̇ = i + U+0307)
    (0x1E9E, 0x1E9E),  # ẞ
    (0x2000, 0x206F),  # genel noktalama: ‘ ’ “ ” „ ‚ – — … • ‹ ›
    (0x20A0, 0x20CF),  # para birimleri (€; ₺ Figtree'de yok)
    (0x2122, 0x2122),  # ™
    (0x2190, 0x2199),  # oklar (→)
    (0x2212, 0x2212), (0x2215, 0x2215), (0x2260, 0x2260), (0x2264, 0x2265),
    (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD),
]
OZELLIKLER = ['ccmp', 'locl', 'kern', 'mark', 'mkmk', 'case', 'tnum', 'pnum', 'liga', 'calt', 'rlig', 'rvrn']


def kod_noktalari():
    return [c for a, b in ARALIKLAR for c in range(a, b + 1)]


def kaynak(agirlik):
    return KAYNAK / agirlik / f'Figtree_{agirlik}.ttf'


def hedef(agirlik):
    return HEDEF / f'Figtree_{agirlik}.woff2'


def uret(agirlik):
    secenek = subset.Options()
    secenek.flavor = 'woff2'
    secenek.layout_features = OZELLIKLER
    secenek.name_IDs = ['*']
    secenek.name_languages = ['*']
    secenek.notdef_outline = True
    secenek.glyph_names = False
    secenek.hinting = True  # KK5: ipuçları korunur (Windows'ta çizim aynı kalsın)
    font = subset.load_font(str(kaynak(agirlik)), secenek)
    altkume = subset.Subsetter(options=secenek)
    altkume.populate(unicodes=kod_noktalari())
    altkume.subset(font)
    HEDEF.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(hedef(agirlik)), secenek)


def denetle():
    metin = (KOK / 'src' / 'i18n' / 'tr.json').read_text(encoding='utf-8')
    gerekli = {ord(c) for c in metin if ord(c) >= 0x20} | {ord(c) for c in 'ğüşöçıİĞÜŞÖÇâîû‘’“”…–—•€'}
    hata = 0
    for agirlik in AGIRLIKLAR:
        asil = TTFont(str(kaynak(agirlik))).getBestCmap()
        alt = TTFont(str(hedef(agirlik))).getBestCmap()
        eksik = sorted(c for c in gerekli if c in asil and c not in alt)
        if eksik:
            hata += 1
            print(f'{agirlik}: alt kümede eksik: {" ".join(f"U+{c:04X}" for c in eksik)}')
        print(f'{agirlik}: {kaynak(agirlik).stat().st_size} B ttf → {hedef(agirlik).stat().st_size} B woff2, {len(alt)}/{len(asil)} karakter')
    fontta_yok = sorted(c for c in gerekli if c not in TTFont(str(kaynak(AGIRLIKLAR[0]))).getBestCmap())
    print('Figtree\'de olmayan (sistem fontu, değişmedi): ' + ' '.join(chr(c) for c in fontta_yok))
    return hata == 0


if __name__ == '__main__':
    if '--denetle' not in sys.argv:
        for a in AGIRLIKLAR:
            uret(a)
    sys.exit(0 if denetle() else 1)
