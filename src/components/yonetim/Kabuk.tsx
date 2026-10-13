import { Image } from 'expo-image';
import { Link, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Logo } from '@/components/ui/Logo';
import { aktifMenu, GENIS_EKRAN, MENU, type MenuOgesi } from '@/features/yonetim/menu';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { AltCizgiliSekmeler, type SekmeTanimi } from './Ortak';
import { yRenk } from './tema';
import { YonetimIkon } from './YonetimIkon';

type Kullanici = { ad: string; harf: string };

/** Menü arkasındaki soluk kesik rota (kanvas BO-0: 232 × 220, altta 70 px, %35). */
function MenuRotasi() {
  return (
    <Svg width={232} height={220} viewBox="0 0 232 220" style={s.rota} aria-hidden>
      <Path d="M-10 190 C60 120 110 200 170 130 S230 60 250 70" stroke={yRenk.vurgu} strokeWidth={5} fill="none" strokeDasharray="11 8" />
      <Circle cx={52} cy={152} r={7} fill={yRenk.vurgu} />
      <Circle cx={196} cy={96} r={7} fill={yRenk.zemin} />
    </Svg>
  );
}

/** Logo (36 × 22, koyu zemin) + "tripmate" (Archivo 19) + "YÖNETİM" (10 px 800, #FFB27A). */
function Marka() {
  return (
    <View style={s.marka}>
      <Logo boyut={36} koyuZemin />
      <View style={s.markaYazi}>
        <Text style={s.markaAd}>tripmate</Text>
        <Text style={s.markaAlt}>{ty('marka').toLocaleUpperCase('tr-TR')}</Text>
      </View>
    </View>
  );
}

/**
 * #155 KK1 / KK6 (kanvas BO-0): sol menü 232 px Gece; üstte logo + "YÖNETİM", arkada soluk kesik rota; öğeler 42 px,
 * seçili açık zemin + Mandalina ikon + 7 px nokta; altta kullanıcı kartı (Mandalina avatar, ad, "Admin").
 * < 1200 px (#135 düzeni, yeni renkler): 56 px Gece üst çubuk (menü simgesi, logo, avatar); menü açılınca çubuğun altında
 * iki sütunlu Gece katman, arkadaki sayfa %35 soluk.
 */
export function Kabuk({ kullanici, children }: { kullanici: Kullanici | null; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const genis = width >= GENIS_EKRAN;
  const yol = usePathname();
  const aktif = aktifMenu(yol);
  // Menü açıldığı sayfaya bağlı: dar ekranda başka sayfaya geçince kendiliğinden kapanır.
  const [acikYol, setAcikYol] = useState<string | null>(null);
  const acik = acikYol === yol;

  if (!genis) {
    return (
      <View style={[s.ekran, s.sutun]}>
        <View style={s.darUst}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ty(acik ? 'menu.kapat' : 'menu.ac')}
            accessibilityState={{ expanded: acik }}
            onPress={() => setAcikYol(acik ? null : yol)}
            style={s.darMarka}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={yRenk.zemin} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <Path d={acik ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
            </Svg>
            <Marka />
          </Pressable>
          {kullanici ? (
            <View accessibilityLabel={ty('rol', { ad: kullanici.ad })} style={s.darAvatar}>
              <Text style={s.darAvatarHarf}>{kullanici.harf}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.icerik}>
          <View style={[s.icerik, acik && s.soluk]} pointerEvents={acik ? 'none' : 'auto'}>
            {children}
          </View>
          {acik ? (
            <View style={s.darMenu}>
              {MENU.map((oge) => (
                <View key={oge.anahtar} style={s.darHucre}>
                  <MenuSatiri oge={oge} secili={oge.anahtar === aktif} dar />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.ekran, s.satir]}>
      <View style={s.menu}>
        <MenuRotasi />
        <Marka />
        {MENU.map((oge) => (
          <MenuSatiri key={oge.anahtar} oge={oge} secili={oge.anahtar === aktif} />
        ))}
        {kullanici ? (
          <View accessibilityLabel={ty('rol', { ad: kullanici.ad })} style={s.kullanici}>
            <View style={s.avatar}>
              <Text style={s.avatarHarf}>{kullanici.harf}</Text>
            </View>
            <View style={s.kullaniciYazi}>
              <Text numberOfLines={1} style={s.kullaniciAd}>
                {kullanici.ad}
              </Text>
              <Text style={s.kullaniciRol}>{ty('rolEtiket')}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={s.icerik}>{children}</View>
    </View>
  );
}

function MenuSatiri({ oge, secili, dar }: { oge: MenuOgesi; secili: boolean; dar?: boolean }) {
  return (
    <Link href={oge.yol as never} asChild>
      {/* Link asChild stili DOM'a doğrudan yazar (web): dizi değil düz nesne verilir. */}
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: secili }}
        style={StyleSheet.flatten([s.oge, dar && s.ogeDar, secili && s.ogeSecili])}>
        <YonetimIkon ad={oge.anahtar} renk={secili ? yRenk.vurgu : yRenk.menuIkon} />
        <Text numberOfLines={1} style={[s.ogeMetin, secili && s.ogeMetinSecili]}>
          {ty(`menu.${oge.anahtar}`)}
        </Text>
        {secili ? <View style={s.ogeNokta} /> : null}
      </Pressable>
    </Link>
  );
}

type BaslikProps = {
  /** Üst etiket (kanvas "ŞEHİRLER", "GENEL BAKIŞ · 13 EKİM SALI"); büyük harfe çevrilir. */
  ust?: string;
  baslik: string;
  /** 52 px, 16 köşe küçük kapak (adres). */
  kapak?: string | null;
  /** Başlığın yanında durum rozeti (Ortak › Rozet). */
  rozet?: ReactNode;
  /** Sağda eylemlerden önce kayıt durumu (Ortak › KayitDurumu). */
  durum?: ReactNode;
  eylemler?: ReactNode;
  sekmeler?: SekmeTanimi<string>;
};

/**
 * #155 KK2 (kanvas BO-0 / BO-1): beyaz başlık, 18 / 28 iç boşluk, alt çizgi; [kapak] üst etiket + Archivo 26 başlık
 * [+ rozet]; sağda kayıt durumu + eylemler (10 aralık); altında alt çizgili sekmeler, sekme yoksa 10 px boşluk.
 */
export function SayfaBasligi({ ust, baslik, kapak, rozet, durum, eylemler, sekmeler }: BaslikProps) {
  return (
    <View style={s.baslikKap}>
      <View style={s.baslikSatir}>
        {kapak ? <Image source={{ uri: kapak }} style={s.kapak} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
        <View style={s.baslikMetin}>
          {ust ? <Text style={s.ust}>{ust.toLocaleUpperCase('tr-TR')}</Text> : null}
          <View style={s.baslikIc}>
            <Text accessibilityRole="header" numberOfLines={1} style={s.baslik}>
              {baslik}
            </Text>
            {rozet}
          </View>
        </View>
        {durum || eylemler ? (
          <View style={s.eylemler}>
            {durum}
            {eylemler}
          </View>
        ) : null}
      </View>
      {sekmeler ? <AltCizgiliSekmeler {...sekmeler} /> : <View style={s.sekmesiz} />}
    </View>
  );
}

/** Eski ad: yalnız başlık + eylemler. */
export function UstCubuk({ baslik, eylemler }: { baslik: string; eylemler?: ReactNode }) {
  return <SayfaBasligi baslik={baslik} eylemler={eylemler} />;
}

/**
 * Sayfa: başlık + Buz zeminde gövde (kanvas BO-0: 24 / 28 iç boşluk, 20 aralık).
 * `sutunlu`: gövde kaydırılmaz, sütunlar yan yana kendi kaydırmalarını taşır (editörler: liste · orta · önizleme).
 * `ust` verilmezse bulunulan menü bölümünün adı.
 */
export function YonetimSayfasi({ sutunlu, children, ust, ...baslik }: BaslikProps & { sutunlu?: boolean; children?: ReactNode }) {
  const aktif = aktifMenu(usePathname());
  const bolum = aktif ? ty(`menu.${aktif}`) : undefined;
  return (
    <View style={s.sayfa}>
      <SayfaBasligi ust={ust ?? (bolum !== baslik.baslik ? bolum : undefined)} {...baslik} />
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

/** Gövde açıklama satırı (13 px Gri mavi). */
export function Aciklama({ children }: { children: ReactNode }) {
  return <Text style={s.aciklama}>{children}</Text>;
}

/** Editör sütunları (kanvas BO-1): yan sütunlar beyaz + Çizgi kenar; ortası Buz üstünde beyaz kâğıt. */
export const sutun = StyleSheet.create({
  sol: { width: 250, flexShrink: 0, backgroundColor: yRenk.zemin, borderRightWidth: 1, borderRightColor: yRenk.ayrac },
  sag: { width: 360, flexShrink: 0, backgroundColor: yRenk.zemin, borderLeftWidth: 1, borderLeftColor: yRenk.ayrac },
  orta: { flex: 1, minWidth: 0 },
  ortaIc: { flexGrow: 1, paddingVertical: 24, paddingHorizontal: 28 },
  kagit: { backgroundColor: yRenk.zemin, borderRadius: 24, boxShadow: '0 10px 30px rgba(21,42,107,0.08)', paddingVertical: 24, paddingHorizontal: 28, gap: 14 },
});

const s = StyleSheet.create({
  ekran: { flex: 1, minHeight: '100%', backgroundColor: yRenk.yuzey },
  satir: { flexDirection: 'row' },
  sutun: { flexDirection: 'column' },
  menu: {
    width: 232,
    flexShrink: 0,
    backgroundColor: yRenk.ana,
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 18,
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  rota: { position: 'absolute', left: 0, bottom: 70, opacity: 0.35 },
  marka: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, paddingBottom: 22 },
  markaYazi: { gap: 4 },
  markaAd: { fontFamily: yazi.baslik, fontSize: 19, lineHeight: 19, letterSpacing: -0.67, color: yRenk.zemin },
  markaAlt: { fontFamily: yazi.ekstra, fontSize: 10, lineHeight: 10, letterSpacing: 1, color: yRenk.menuEtiket },
  oge: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingHorizontal: 12, borderRadius: 12 },
  ogeSecili: { backgroundColor: 'rgba(255,255,255,0.12)' },
  ogeMetin: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.menuMetin },
  ogeMetinSecili: { color: yRenk.zemin },
  ogeNokta: { marginLeft: 'auto', width: 7, height: 7, borderRadius: 4, backgroundColor: yRenk.vurgu },
  kullanici: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  avatar: { width: 36, height: 36, borderRadius: 11, backgroundColor: yRenk.vurgu, alignItems: 'center', justifyContent: 'center' },
  avatarHarf: { fontFamily: yazi.baslik, fontSize: 15, color: yRenk.metin },
  kullaniciYazi: { flex: 1, minWidth: 0 },
  kullaniciAd: { fontFamily: yazi.ekstra, fontSize: 13, lineHeight: 15.6, color: yRenk.zemin },
  kullaniciRol: { fontFamily: yazi.normal, fontSize: 11, lineHeight: 13.2, color: yRenk.menuMetin },
  darUst: { height: 56, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, backgroundColor: yRenk.ana },
  darMarka: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  darAvatar: { width: 30, height: 30, borderRadius: 9, backgroundColor: yRenk.vurgu, alignItems: 'center', justifyContent: 'center' },
  darAvatarHarf: { fontFamily: yazi.baslik, fontSize: 13, color: yRenk.metin },
  darMenu: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: yRenk.ana,
    boxShadow: '0 10px 24px rgba(14,20,48,0.2)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  darHucre: { width: '50%', paddingHorizontal: 2 },
  soluk: { opacity: 0.35 },
  ogeDar: { height: 40 },
  icerik: { flex: 1, minWidth: 0 },
  sayfa: { flex: 1, backgroundColor: yRenk.yuzey },
  baslikKap: { flexShrink: 0, paddingTop: 18, paddingHorizontal: 28, backgroundColor: yRenk.zemin, borderBottomWidth: 1, borderBottomColor: yRenk.ayrac, gap: 8 },
  baslikSatir: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  kapak: { width: 52, height: 52, flexShrink: 0, borderRadius: 16, backgroundColor: '#ffe2cc' },
  baslikMetin: { flexShrink: 1, minWidth: 0, gap: 2 },
  ust: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: 0.88, color: yRenk.soluk },
  baslikIc: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baslik: { flexShrink: 1, fontFamily: yazi.baslik, fontSize: 26, lineHeight: 30, letterSpacing: -0.78, color: yRenk.metin },
  eylemler: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  sekmesiz: { height: 10 },
  govde: { flex: 1 },
  sutunlar: { flex: 1, minHeight: 0, flexDirection: 'row' },
  govdeIc: { paddingVertical: 24, paddingHorizontal: 28, gap: 20 },
  aciklama: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 19, color: yRenk.ikincil },
});
