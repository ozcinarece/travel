import { Link, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { aktifMenu, GENIS_EKRAN, MENU, type MenuOgesi } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { yGolge, yRenk } from './tema';
import { YonetimIkon } from './YonetimIkon';

type Kullanici = { ad: string; harf: string };

/**
 * #106 KK4: kanvastaki kabuk — sol menü 210 px (#f6f6f4, sağda 1 px #ebebeb), içerik sağda.
 * < 1200 px: aynı menü bloğu üstte tam genişlikte; "Yönetim" satırına basınca açılır/kapanır.
 */
export function Kabuk({ kullanici, children }: { kullanici: Kullanici | null; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const genis = width >= GENIS_EKRAN;
  const yol = usePathname();
  const aktif = aktifMenu(yol);
  // Menü açıldığı sayfaya bağlı: dar ekranda başka sayfaya geçince kendiliğinden kapanır.
  const [acikYol, setAcikYol] = useState<string | null>(null);
  const acik = acikYol === yol;

  const ogeler = genis || acik;
  return (
    <View style={[s.ekran, genis ? s.satir : s.sutun]}>
      <View style={[s.menu, genis ? s.menuGenis : s.menuDar]}>
        <Pressable
          accessibilityRole={genis ? undefined : 'button'}
          accessibilityLabel={genis ? undefined : ty(acik ? 'menu.kapat' : 'menu.ac')}
          accessibilityState={genis ? undefined : { expanded: acik }}
          disabled={genis}
          onPress={() => setAcikYol(acik ? null : yol)}
          style={s.marka}>
          <View style={s.markaIsaret} />
          <Text style={s.markaMetin}>{ty('marka')}</Text>
        </Pressable>
        {ogeler ? (
          <>
            {MENU.map((oge) => (
              <MenuSatiri key={oge.anahtar} oge={oge} secili={oge.anahtar === aktif} />
            ))}
            {kullanici ? (
              <View style={[s.kullanici, genis && s.kullaniciAltta]}>
                <View style={s.avatar}>
                  <Text style={s.avatarHarf}>{kullanici.harf}</Text>
                </View>
                <Text style={s.kullaniciAd}>{ty('rol', { ad: kullanici.ad })}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      <View style={s.icerik}>{children}</View>
    </View>
  );
}

function MenuSatiri({ oge, secili }: { oge: MenuOgesi; secili: boolean }) {
  const renk = secili ? yRenk.metin : yRenk.ikincil;
  return (
    <Link href={oge.yol as never} asChild>
      {/* Link asChild stili DOM'a doğrudan yazar (web): dizi değil düz nesne verilir. */}
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: secili }}
        style={StyleSheet.flatten([s.oge, secili && s.ogeSecili])}>
        <YonetimIkon ad={oge.anahtar} renk={renk} />
        <Text style={[s.ogeMetin, secili ? s.ogeMetinSecili : { color: renk }]}>{ty(`menu.${oge.anahtar}`)}</Text>
      </Pressable>
    </Link>
  );
}

/** Kanvastaki üst çubuk: 56 px, alt çizgi, solda sayfa başlığı (17 px 800), sağda eylemler (8 px aralık). */
export function UstCubuk({ baslik, eylemler }: { baslik: string; eylemler?: ReactNode }) {
  return (
    <View style={s.ustCubuk}>
      <Text accessibilityRole="header" numberOfLines={1} style={s.baslik}>
        {baslik}
      </Text>
      {eylemler ? <View style={s.eylemler}>{eylemler}</View> : null}
    </View>
  );
}

/**
 * Sayfa: üst çubuk + kaydırılan gövde (kanvas içerik boşluğu 20 / 24, 12 aralık).
 * `sutunlu`: gövde kaydırılmaz, sütunlar yan yana kendi kaydırmalarını taşır (gezi editörü: liste · sekmeler · önizleme).
 */
export function YonetimSayfasi({ baslik, eylemler, sutunlu, children }: { baslik: string; eylemler?: ReactNode; sutunlu?: boolean; children?: ReactNode }) {
  return (
    <View style={s.sayfa}>
      <UstCubuk baslik={baslik} eylemler={eylemler} />
      {sutunlu ? (
        <View style={s.sutunlar}>{children}</View>
      ) : (
        <ScrollView style={s.govde} contentContainerStyle={s.govdeIc}>
          {children}
        </ScrollView>
      )}
    </View>
  );
}

/** Gövde açıklama satırı (kanvas: 13 px #6e6e6e). */
export function Aciklama({ children }: { children: ReactNode }) {
  return <Text style={s.aciklama}>{children}</Text>;
}

const s = StyleSheet.create({
  ekran: { flex: 1, minHeight: '100%', backgroundColor: yRenk.zemin },
  satir: { flexDirection: 'row' },
  sutun: { flexDirection: 'column' },
  menu: { backgroundColor: yRenk.yuzey, paddingVertical: 18, paddingHorizontal: 12, gap: 4 },
  menuGenis: { width: 210, flexShrink: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac },
  menuDar: { borderBottomWidth: 1, borderBottomColor: yRenk.ayrac },
  marka: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 16 },
  markaIsaret: { width: 26, height: 26, borderRadius: 8, backgroundColor: yRenk.metin },
  markaMetin: { fontFamily: yazi.ekstra, fontSize: 14, letterSpacing: -0.28, color: yRenk.metin },
  oge: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 38, paddingHorizontal: 12, borderRadius: 10 },
  ogeSecili: { backgroundColor: yRenk.zemin, boxShadow: yGolge },
  ogeMetin: { fontFamily: yazi.yari, fontSize: 13 },
  ogeMetinSecili: { fontFamily: yazi.ekstra, color: yRenk.metin },
  kullanici: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  kullaniciAltta: { marginTop: 'auto' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: yRenk.metin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHarf: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.zemin },
  kullaniciAd: { fontFamily: yazi.kalin, fontSize: 12, color: yRenk.metin },
  icerik: { flex: 1, minWidth: 0 },
  sayfa: { flex: 1 },
  ustCubuk: {
    height: 56,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: yRenk.ayrac,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 12,
  },
  baslik: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.34, color: yRenk.metin },
  eylemler: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  govde: { flex: 1 },
  sutunlar: { flex: 1, minHeight: 0, flexDirection: 'row' },
  govdeIc: { paddingVertical: 20, paddingHorizontal: 24, gap: 12 },
  aciklama: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19, color: yRenk.ikincil },
});
