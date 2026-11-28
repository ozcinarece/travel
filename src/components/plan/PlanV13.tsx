// #667 Plan v13 (UX önerileri kanvası › "Plan v13 · ONAYLI": `Plan_v13_Genel` · `Plan_v13_Gun`). Plan sekmesi genel bakışla
// açılır: "Plan" 28/800, sağda katılımcı yüzleri (30 pt, 2 pt beyaz kenar, -8 bindirme) ve ⋯ (40 pt #F2F4F8); 230 pt harita
// (köşe 18, her günün rotası kendi renginde, sol üstte gün lejantı); "Güne konmamış N yer · Yerleştir ›"; gün kartları (#F6F7FA,
// köşe 16, 10 pt gün noktası, "N. gün · Per 7 Ocak" 16/700, "K durak · X / 8 sa" 13, 6 pt dolgu çubuğu; boş gün 1,5 pt kesik
// #9AA6C8 çerçeve + "+ Doldur"). Karta dokununca gün detayı: geri + "N. gün · …" 20/800 + "Düzenle"; 190 pt numaralı harita;
// özet satırı; otel satırı, durak ve bacak satırları (`DurakSatirlari`, sağda ekleyenin yüzü); bugünse "Akşam için yakında";
// altta sabit turuncu "+ Durak ekle".
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BolumBasligi, BugunBosV7, TuruncuDugme, type BosGunYeri } from '@/components/gezi/SeyahatV7';
import { Harita } from '@/components/harita/Harita';
import type { HaritaCizgisi, HaritaPini, Konum } from '@/components/harita/tipler';
import { DurakSatirlari, type PlanSatirGorunumu } from '@/components/plan/PlanListesi';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { anaV5, planV13, renk, yazi } from '@/theme';

/** Kanvas: genel bakış haritası 230 pt, gün detayı haritası 190 pt. */
export const GENEL_HARITA_BOY = 230;
export const GUN_HARITA_BOY = 190;

export type YuzV13 = { id: string; ad: string; url: string | null; zemin: string; harf: string };

// ---------------------------------------------------------------- harita

export function PlanHaritasi(p: {
  boy: number;
  merkez: Konum;
  pinler: HaritaPini[];
  cizgiler: HaritaCizgisi[];
  /** Kadraj noktaları; boşsa `merkez` zoom 13. */
  noktalar: Konum[];
  onPress: () => void;
  /** KK3: sol üstte gün lejantı. */
  lejant?: { id: string; renk: string; etiket: string }[];
}) {
  return (
    <View style={[s.harita, { height: p.boy }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('planV13.haritayiAc')} onPress={p.onPress} style={StyleSheet.absoluteFill}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Harita merkez={p.merkez} zoom={13} pinler={p.pinler} cizgiler={p.cizgiler} sigdir={p.noktalar.length > 0 ? { noktalar: p.noktalar, ust: p.lejant?.length ? 48 : 24, alt: 24 } : undefined} />
        </View>
      </Pressable>
      {p.lejant && p.lejant.length > 0 ? (
        <View style={s.lejant} pointerEvents="none">
          {p.lejant.map((l) => (
            <View key={l.id} style={s.lejantHap}>
              <View style={[s.lejantNokta, { backgroundColor: l.renk }]} />
              <Text style={s.lejantMetin}>{l.etiket}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- genel bakış (KK3)

export type GunKartiGorunumu = { id: string; renk: string; baslik: string; alt: string; oran: number; bos: boolean };

export function PlanGenel(p: {
  yuzler: YuzV13[];
  onYuzler: () => void;
  onDaha: () => void;
  harita: ReactNode;
  /** "Güne konmamış N yer"; 0 ise satır yok. */
  gunsuz: number;
  onYerlestir: () => void;
  kartlar: GunKartiGorunumu[];
  onKart: (id: string) => void;
  onDoldur: (id: string) => void;
  uyari: string | null;
}) {
  const ust = useSafeAreaInsets().top;
  return (
    <ScrollView style={s.ekran} contentContainerStyle={{ paddingTop: ust + 8, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={s.genelUst}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('plan.baslik')}
        </Text>
        <View style={s.sagUst}>
          {p.yuzler.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('seyahat.grup.baslik')} onPress={p.onYuzler} style={s.yuzlerDokunma}>
              {p.yuzler.slice(0, 3).map((y, i) => (
                <View key={y.id} style={[s.yuzCerceve, i > 0 && { marginLeft: -8 }]}>
                  <Avatar ad={y.ad} url={y.url} boyut={30} yuvarlak arkaPlan={y.zemin} harfRengi={y.harf} harfBoyutu={12} />
                </View>
              ))}
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('plan.diger')} onPress={p.onDaha} hitSlop={4} style={({ pressed }) => [s.yuvarlak, pressed && { opacity: 0.8 }]}>
            <Ikon ad="dahaV7" boyut={18} renk={renk.metin} kalinlik={2.2} />
          </Pressable>
        </View>
      </View>
      {p.harita}
      <View style={s.genelGovde}>
        {p.uyari ? <Text style={s.uyari}>{p.uyari}</Text> : null}
        {p.gunsuz > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('planV13.yerlestirEtiket', { n: p.gunsuz })} onPress={p.onYerlestir} style={({ pressed }) => [s.gunsuz, pressed && { opacity: 0.8 }]}>
            <Text style={s.gunsuzMetin}>{t('planV13.gunsuz', { n: p.gunsuz })}</Text>
            <Text style={s.baglanti}>{t('planV13.yerlestir')}</Text>
          </Pressable>
        ) : null}
        {p.kartlar.map((k) =>
          k.bos ? (
            <Pressable
              key={k.id}
              accessibilityRole="button"
              accessibilityLabel={t('planV13.kartEtiket', { baslik: k.baslik, alt: t('planV13.bosGun') })}
              onPress={() => p.onKart(k.id)}
              style={({ pressed }) => [s.kart, s.bosKart, pressed && { opacity: 0.85 }]}>
              <View style={[s.kartNokta, { backgroundColor: k.renk }]} />
              <View style={s.bosMetinler}>
                <Text style={s.kartBaslik} numberOfLines={1}>
                  {k.baslik}
                </Text>
                <Text style={s.kartAlt}>{t('planV13.bosGun')}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('planV13.doldurEtiket', { gun: k.baslik })} onPress={() => p.onDoldur(k.id)} hitSlop={12} style={s.doldur}>
                <Ikon ad="artiV7" boyut={16} renk={renk.ana} kalinlik={2.4} />
                <Text style={s.doldurMetin}>{t('planV13.doldur')}</Text>
              </Pressable>
            </Pressable>
          ) : (
            <Pressable
              key={k.id}
              accessibilityRole="button"
              accessibilityLabel={t('planV13.kartEtiket', { baslik: k.baslik, alt: k.alt })}
              onPress={() => p.onKart(k.id)}
              style={({ pressed }) => [s.kart, s.doluKart, pressed && { opacity: 0.85 }]}>
              <View style={s.kartSatir}>
                <View style={[s.kartNokta, { backgroundColor: k.renk }]} />
                <Text style={[s.kartBaslik, { flex: 1 }]} numberOfLines={1}>
                  {k.baslik}
                </Text>
                <Text style={s.kartAlt}>{k.alt}</Text>
                <Ikon ad="okV7p" boyut={18} renk={planV13.ok} kalinlik={2.4} />
              </View>
              <View style={s.cubukIz}>
                <View testID={`dolgu:${k.id}`} style={[s.cubukDolu, { width: `${Math.round(k.oran * 100)}%`, backgroundColor: k.renk }]} />
              </View>
            </Pressable>
          ),
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- gün detayı (KK4)

export function PlanGunDetayi(p: {
  baslik: string;
  onGeri: () => void;
  onDuzenle: (() => void) | null;
  harita: ReactNode;
  ozet: string;
  /** Otel satırı: otel varsa "Otel: ad" ve çıkış saati; yoksa "Otel ekle". */
  otel: { baslik: string; saat: string | null; onPress: () => void } | null;
  bugun: boolean;
  satirlar: PlanSatirGorunumu[];
  onDurak: (mekanId: string) => void;
  onDurakUzunBas: (mekanId: string) => void;
  onBaskaGuneTasi?: (durakId: string) => void;
  /** Günde hiç durak yoksa "{gün} henüz boş" ve açıklama. */
  bosGun: { baslik: string; metin: string } | null;
  aksam: { yerler: BosGunYeri[]; eklenenler: Set<string>; onEkle: (id: string) => void; pasif?: boolean; onTumu: () => void } | null;
  onDurakEkle: () => void;
  uyari: string | null;
}) {
  const ust = useSafeAreaInsets().top;
  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={{ paddingTop: ust + 8, paddingBottom: ALT_DUGME_PAYI }} showsVerticalScrollIndicator={false}>
        <View style={s.gunUst}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('planV13.geri')} onPress={p.onGeri} hitSlop={8} style={s.geri}>
            <Ikon ad="geri" boyut={22} renk={renk.metin} kalinlik={2.4} />
            <Text accessibilityRole="header" style={s.gunBaslik} numberOfLines={1}>
              {p.baslik}
            </Text>
          </Pressable>
          {p.onDuzenle ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('planV13.duzenleEtiket')} onPress={p.onDuzenle} hitSlop={12}>
              <Text style={s.duzenle}>{t('planV13.duzenle')}</Text>
            </Pressable>
          ) : null}
        </View>
        {p.harita}
        <View style={s.gunGovde}>
          {p.ozet ? <Text style={s.ozet}>{p.ozet}</Text> : null}
          {p.uyari ? <Text style={s.uyari}>{p.uyari}</Text> : null}
          {p.otel ? (
            <Pressable accessibilityRole="button" onPress={p.otel.onPress} style={({ pressed }) => [s.otel, pressed && { opacity: 0.8 }]}>
              <Text style={s.saat}>{p.otel.saat ?? ''}</Text>
              <View style={s.yatak}>
                <Ikon ad="yatakV7p" boyut={16} renk={renk.ana} kalinlik={2} />
              </View>
              <Text style={s.otelAd} numberOfLines={1}>
                {p.otel.baslik}
              </Text>
            </Pressable>
          ) : null}
          {p.bosGun ? (
            <View style={s.bos}>
              <Text accessibilityRole="header" style={s.bosBaslik}>
                {p.bosGun.baslik}
              </Text>
              <Text style={s.bosMetin}>{p.bosGun.metin}</Text>
            </View>
          ) : null}
          <DurakSatirlari satirlar={p.satirlar} bugun={p.bugun} onDurak={p.onDurak} onDurakUzunBas={p.onDurakUzunBas} onBaskaGuneTasi={p.onBaskaGuneTasi} />
          {p.aksam ? (
            <View>
              <BolumBasligi baslik={t('plan.aksamYakinda')} baglanti={t('plan.tumu')} onBaglanti={p.aksam.onTumu} />
              <BugunBosV7 yerler={p.aksam.yerler} eklenenler={p.aksam.eklenenler} onEkle={p.aksam.onEkle} pasif={p.aksam.pasif} />
            </View>
          ) : null}
        </View>
      </ScrollView>
      {/* KK4: sabit turuncu "+ Durak ekle" — alt menünün 12 pt üstünde (kanvas: 84 + 12). */}
      <View style={s.altDugme}>
        <TuruncuDugme metin={t('planV13.durakEkle')} onPress={p.onDurakEkle} />
      </View>
    </View>
  );
}

/** Sabit düğme (52) + alt boşluk (12) + nefes payı: liste düğmenin altında kalmasın. */
const ALT_DUGME_PAYI = 52 + 12 + 24;

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  // KK3 üst: padding 52 16 10 (güvenli alan + 8).
  genelUst: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, color: renk.metin },
  sagUst: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yuzlerDokunma: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  yuzCerceve: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 17 },
  yuvarlak: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: planV13.dugmeZemin,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: renk.metin,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  harita: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: planV13.haritaZemin },
  lejant: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, right: 12 },
  lejantHap: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: renk.zemin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: renk.metin,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  lejantNokta: { width: 8, height: 8, borderRadius: 4 },
  lejantMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  genelGovde: { paddingTop: 4, paddingHorizontal: 16 },
  uyari: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil, paddingVertical: 6 },
  // "Güne konmamış N yer · Yerleştir ›": padding 14 0 4.
  gunsuz: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, paddingBottom: 4, minHeight: 44 },
  gunsuzMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  baglanti: { fontFamily: yazi.kalin, fontSize: 14, color: renk.ana },
  kart: { marginTop: 10, padding: 14, borderRadius: 16 },
  doluKart: { backgroundColor: planV13.kartZemin, gap: 8 },
  bosKart: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: planV13.bosKenar, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kartSatir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kartNokta: { width: 10, height: 10, borderRadius: 5 },
  kartBaslik: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  cubukIz: { height: 6, borderRadius: 3, backgroundColor: planV13.cubukIz, overflow: 'hidden', marginLeft: 22 },
  cubukDolu: { height: 6 },
  bosMetinler: { flex: 1, minWidth: 0 },
  doldur: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doldurMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana },
  // KK4 üst: padding 52 16 8.
  gunUst: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  geri: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, flexShrink: 1 },
  gunBaslik: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 20, color: renk.metin },
  duzenle: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana },
  gunGovde: { paddingTop: 10, paddingHorizontal: 16 },
  ozet: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil, paddingBottom: 4 },
  otel: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 44 },
  saat: { width: 44, fontFamily: yazi.kalin, fontSize: 14, color: anaV5.ikincil, fontVariant: ['tabular-nums'] },
  yatak: { width: 28, height: 28, borderRadius: 14, backgroundColor: planV13.kartZemin, alignItems: 'center', justifyContent: 'center' },
  otelAd: { flex: 1, fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  bos: { paddingTop: 14, paddingBottom: 10, gap: 6 },
  bosBaslik: { fontFamily: yazi.ekstra, fontSize: 19, color: renk.metin },
  bosMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: anaV5.ikincil },
  altDugme: { position: 'absolute', left: 16, right: 16, bottom: 12 },
});
