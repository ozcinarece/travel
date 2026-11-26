// #308 (kanvas UX önerileri › "#308 Seyahat sayfası · v7": `Sayfa_v7_Seyahat_PlanModu`, `_GeziModu`, `_TekBos`): seyahat
// sayfasının v7 parçaları. Ölçüler ve renkler kanvastan birebir. Ekranda tek dolu turuncu düğme (KK5).
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Harita } from '@/components/harita/Harita';
import type { HaritaCizgisi, HaritaPini, Konum } from '@/components/harita/tipler';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { anaV5, renk, seyahatV7, yazi } from '@/theme';

// ---------------------------------------------------------------- KK1 üst harita (260 pt, köşesiz)

export const UST_HARITA_BOY = 260;

export function UstHarita(p: {
  merkez: Konum;
  pinler: HaritaPini[];
  cizgiler: HaritaCizgisi[];
  onHarita: () => void;
  onGeri: () => void;
  /** #454 çekmecesi; hesapsız oturumda yok. */
  onPaylas?: () => void;
  onMenu: () => void;
}) {
  const ust = useSafeAreaInsets().top;
  const noktalar = p.pinler.map((x) => x.konum);
  return (
    <View style={s.harita}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('seyahatV7.haritayiAc')} onPress={p.onHarita} style={StyleSheet.absoluteFill}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Harita merkez={p.merkez} zoom={13} pinler={p.pinler} cizgiler={p.cizgiler} sigdir={noktalar.length > 0 ? { noktalar, ust: ust + 56, alt: 24 } : undefined} />
        </View>
      </Pressable>
      <View style={[s.haritaUst, { paddingTop: Math.max(ust, 12) + 8 }]} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel={t('seyahatV7.geri')} onPress={p.onGeri} style={s.yuvarlak} hitSlop={2}>
          <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
        </Pressable>
        <View style={s.sagDugmeler}>
          {p.onPaylas ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('seyahatV7.paylas')} onPress={p.onPaylas} style={s.yuvarlak} hitSlop={2}>
              <Ikon ad="paylasV7" boyut={18} renk={renk.metin} kalinlik={2.2} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('seyahatV7.menu')} onPress={p.onMenu} style={s.yuvarlak} hitSlop={2}>
            <Ikon ad="dahaV7" boyut={18} renk={renk.metin} kalinlik={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- KK2 başlık

export function Baslik({ ad, alt }: { ad: string; alt: string }) {
  return (
    <View style={s.baslikKap}>
      <Text style={s.baslik} numberOfLines={2} accessibilityRole="header">
        {ad}
      </Text>
      <Text style={s.baslikAlt}>{alt}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- KK3 kişiler

export type KisiYuzu = { id: string; ad: string; foto: string | null; vardi: boolean };

function Yuz({ k, i }: { k: KisiYuzu; i: number }) {
  const zemin = seyahatV7.yuzler[i % seyahatV7.yuzler.length];
  // Gece zeminde beyaz, açık mavide Gece, Mandalinada Lacivert harf (kanvas).
  const harfRengi = i % seyahatV7.yuzler.length === 2 ? renk.zemin : i % seyahatV7.yuzler.length === 1 ? renk.ana : renk.metin;
  return (
    <View style={[s.yuz, { backgroundColor: zemin, marginLeft: i === 0 ? 0 : -8 }]}>
      {k.foto ? <Image source={{ uri: k.foto }} style={s.yuzFoto} /> : <Text style={[s.yuzHarf, { color: harfRengi }]}>{k.ad.trim().charAt(0).toLocaleUpperCase('tr') || '?'}</Text>}
      {k.vardi ? <View style={s.yesilNokta} /> : null}
    </View>
  );
}

export function KisilerSatiri(p: { kisiler: KisiYuzu[]; sag: string; sagYesil: boolean; onCagir: () => void; onYuzler: () => void }) {
  if (p.kisiler.length <= 1) {
    const ben = p.kisiler[0];
    return (
      <View style={s.kisiler}>
        <View style={s.tekKisi}>
          {ben ? <Yuz k={ben} i={0} /> : null}
          <Text style={s.kisiMetin}>{t('seyahatV7.yalnizSen')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={p.onCagir} style={s.cagir} hitSlop={4}>
          <Ikon ad="artiV7" boyut={16} renk={renk.ana} kalinlik={2.4} />
          <Text style={s.cagirMetin}>{t('seyahatV7.arkadasCagir')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={s.kisiler}>
      <View style={s.tekKisi}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('seyahatV7.seyahattekiler', { n: p.kisiler.length })} onPress={p.onYuzler} style={s.yuzler}>
          {p.kisiler.slice(0, 4).map((k, i) => (
            <Yuz key={k.id} k={k} i={i} />
          ))}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('seyahatV7.arkadasCagir')} onPress={p.onCagir} style={s.kesikArti} hitSlop={6}>
          <Ikon ad="artiV7" boyut={16} renk={renk.ana} kalinlik={2.4} />
        </Pressable>
      </View>
      <Text style={[s.kisiMetin, p.sagYesil && s.kisiYesil]} numberOfLines={1}>
        {p.sag}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- KK4 sohbet ipucu

export function SohbetIpucu({ kim, metin, onPress }: { kim: string | null; metin: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityHint={t('seyahatV7.sohbetiAc')} onPress={onPress} style={s.ipucu}>
      <Ikon ad="sohbetV7" boyut={18} renk={renk.ana} kalinlik={2} />
      <Text style={s.ipucuMetin} numberOfLines={1}>
        {kim ? <Text style={s.kalin}>{kim} </Text> : null}
        {metin}
      </Text>
      <Ikon ad="ileri" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- KK5 gövde

/** Bölüm başlığı + sağda bağlantı ("Günler · Planı aç ›", "Bugünün planı", "Bugün boş · Rehber ›"). */
export function BolumBasligi({ baslik, baglanti, onBaglanti }: { baslik: string; baglanti?: string; onBaglanti?: () => void }) {
  return (
    <View style={s.bolumBaslik}>
      <Text style={s.bolumMetin} accessibilityRole="header">
        {baslik}
      </Text>
      {baglanti && onBaglanti ? (
        <Pressable accessibilityRole="link" onPress={onBaglanti} hitSlop={12}>
          <Text style={s.baglanti}>{baglanti}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Tek dolu turuncu düğme (52 pt). */
function TuruncuDugme({ metin, ikon, onPress, pasif, mesgul }: { metin: string; ikon?: 'yolTarifiV7'; onPress: () => void; pasif?: boolean; mesgul?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!pasif, busy: !!mesgul }} disabled={pasif || mesgul} onPress={onPress} style={[s.turuncu, pasif && s.pasif]}>
      {ikon ? <Ikon ad={ikon} boyut={18} renk={renk.metin} kalinlik={2.4} /> : null}
      <Text style={s.turuncuMetin}>{metin}</Text>
    </Pressable>
  );
}

export function SiradakiAdimV7(p: { baslik: string; dugme: string; onPress: () => void; pasif?: boolean; mesgul?: boolean }) {
  return (
    <View style={s.odak}>
      <Text style={s.odakEtiket}>{t('seyahatV7.siradakiAdim')}</Text>
      <Text style={[s.odakBaslik, s.odakBaslikBosluk]} numberOfLines={2}>
        {p.baslik}
      </Text>
      <TuruncuDugme metin={p.dugme} onPress={p.onPress} pasif={p.pasif} mesgul={p.mesgul} />
    </View>
  );
}

export function SimdiV7(p: { etiket: string; ad: string; alt: string | null; onYolTarifi: () => void }) {
  return (
    <View style={s.odak}>
      <Text style={s.odakEtiket}>{p.etiket}</Text>
      <Text style={s.odakBaslik} numberOfLines={2}>
        {p.ad}
      </Text>
      {p.alt ? <Text style={s.odakAlt}>{p.alt}</Text> : <View style={s.odakBaslikBosluk} />}
      <TuruncuDugme metin={t('seyahatV7.yolTarifi')} ikon="yolTarifiV7" onPress={p.onYolTarifi} />
    </View>
  );
}

export type GunSatiriV7 = { id: string; renk: string; ust: string; alt: string };

export function GunlerV7({ satirlar, onGun }: { satirlar: GunSatiriV7[]; onGun: (id: string) => void }) {
  return (
    <>
      {satirlar.map((g) => (
        <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`${g.ust}, ${g.alt}`} onPress={() => onGun(g.id)} style={s.gunSatiri}>
          <View style={[s.gunCizgi, { backgroundColor: g.renk }]} />
          <View style={s.satirMetin}>
            <Text style={s.satirBaslik} numberOfLines={1}>
              {g.ust}
            </Text>
            <Text style={s.satirAlt} numberOfLines={1}>
              {g.alt}
            </Text>
          </View>
          <Ikon ad="ileri" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
        </Pressable>
      ))}
    </>
  );
}

export function ListemSatiriV7({ alt, onPress }: { alt: string | null; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.gunSatiri}>
      <Ikon ad="kalpV7" boyut={20} renk={renk.ana} kalinlik={2} />
      <Text style={[s.satirBaslik, s.esnek]}>{t('seyahatV7.listem')}</Text>
      {alt ? <Text style={s.satirAlt}>{alt}</Text> : null}
      <Ikon ad="ileri" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
    </Pressable>
  );
}

export type PlanSatiriV7 = { id: string; ad: string; alt: string; gezildi: boolean; sira: number | null; renk: string };

/** "Bugünün planı": gezilenler yeşil tikli ve soluk, sıradaki gün renginde numaralı. */
export function BugununPlaniV7({ satirlar }: { satirlar: PlanSatiriV7[] }) {
  return (
    <>
      {satirlar.map((d) => (
        <View key={d.id} style={s.planSatiri} accessible accessibilityLabel={`${d.ad}, ${d.alt}`}>
          {d.gezildi ? (
            <View style={[s.planDaire, { backgroundColor: seyahatV7.tikZemin }]}>
              <Ikon ad="tik" boyut={14} renk={renk.basari} kalinlik={2.4} />
            </View>
          ) : (
            <View style={[s.planDaire, { backgroundColor: d.renk }]}>
              <Text style={s.planNo}>{d.sira ?? ''}</Text>
            </View>
          )}
          <View style={s.satirMetin}>
            <Text style={[s.satirBaslik, d.gezildi && s.soluk]} numberOfLines={2}>
              {d.ad}
            </Text>
            <Text style={s.satirAlt}>{d.alt}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

export type BosGunYeri = { id: string; ad: string; alt: string; foto: string | null };

/** Boş gün: yakındaki 3 yer, artıyla bugüne eklenir (turuncu düğme yok). */
export function BugunBosV7({ yerler, eklenenler, onEkle, pasif }: { yerler: BosGunYeri[]; eklenenler: Set<string>; onEkle: (id: string) => void; pasif?: boolean }) {
  return (
    <>
      {yerler.map((y) => {
        const eklendi = eklenenler.has(y.id);
        return (
          <View key={y.id} style={s.yerSatiri}>
            <View style={s.yerFoto}>{y.foto ? <Image source={{ uri: y.foto }} style={StyleSheet.absoluteFill} /> : <Ikon ad="kamera" boyut={22} renk={anaV5.ok} kalinlik={1.8} />}</View>
            <View style={s.satirMetin}>
              <Text style={s.satirBaslik} numberOfLines={2}>
                {y.ad}
              </Text>
              <Text style={s.satirAlt}>{y.alt}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(eklendi ? 'seyahatV7.bugunEklendi' : 'seyahatV7.bugunEkle', { ad: y.ad })}
              accessibilityState={{ disabled: eklendi || !!pasif }}
              disabled={eklendi || pasif}
              onPress={() => onEkle(y.id)}
              hitSlop={6}
              style={[s.yerArti, pasif && s.pasif]}>
              <Ikon ad={eklendi ? 'tik' : 'artiV7'} boyut={16} renk={eklendi ? renk.basari : renk.metin} kalinlik={2.2} />
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  harita: { height: UST_HARITA_BOY, backgroundColor: seyahatV7.haritaZemin, overflow: 'hidden' },
  haritaUst: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  sagDugmeler: { flexDirection: 'row', gap: 10 },
  yuvarlak: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: renk.zemin,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: renk.metin,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  baslikKap: { paddingTop: 14, paddingHorizontal: 16, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 24, letterSpacing: -0.24, lineHeight: 28, color: renk.metin },
  baslikAlt: { fontFamily: yazi.normal, fontSize: 15, color: anaV5.ikincil },
  kisiler: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingHorizontal: 16, gap: 10 },
  tekKisi: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yuzler: { flexDirection: 'row', minHeight: 44, alignItems: 'center' },
  yuz: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  yuzFoto: { width: 28, height: 28, borderRadius: 14 },
  yuzHarf: { fontFamily: yazi.ekstra, fontSize: 12 },
  yesilNokta: { position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: renk.basari, borderWidth: 2, borderColor: renk.zemin },
  kesikArti: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: seyahatV7.kesikKenar, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
  kisiMetin: { flexShrink: 1, fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  kisiYesil: { fontFamily: yazi.yari, color: renk.basariMetin },
  cagir: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cagirMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.ana },
  ipucu: { marginTop: 12, marginHorizontal: 16, paddingVertical: 10, paddingHorizontal: 12, minHeight: 44, borderRadius: 14, backgroundColor: anaV5.satirZemin, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ipucuMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 14, color: renk.metin },
  kalin: { fontFamily: yazi.kalin },
  bolumBaslik: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 18, paddingBottom: 4 },
  bolumMetin: { fontFamily: yazi.ekstra, fontSize: 19, color: renk.metin },
  baglanti: { fontFamily: yazi.kalin, fontSize: 14, color: renk.ana },
  odak: { paddingTop: 18, paddingHorizontal: 16, gap: 4 },
  odakEtiket: { fontFamily: yazi.ekstra, fontSize: 13, letterSpacing: 0.26, color: anaV5.adim },
  odakBaslik: { fontFamily: yazi.ekstra, fontSize: 22, letterSpacing: -0.22, color: renk.metin },
  odakBaslikBosluk: { paddingBottom: 10 },
  odakAlt: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil, paddingBottom: 10 },
  turuncu: { height: 52, borderRadius: 26, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  turuncuMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  pasif: { opacity: 0.4 },
  gunSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: anaV5.cizgi },
  gunCizgi: { width: 4, height: 34, borderRadius: 2 },
  satirMetin: { flex: 1, gap: 1 },
  esnek: { flex: 1 },
  satirBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  soluk: { color: anaV5.ikincil },
  planSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  planDaire: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planNo: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  yerSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  yerFoto: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: anaV5.fotoYok, alignItems: 'center', justifyContent: 'center' },
  yerArti: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: seyahatV7.artiKenar, alignItems: 'center', justifyContent: 'center' },
});
