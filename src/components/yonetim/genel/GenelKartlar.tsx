import { Image } from 'expo-image';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

import {
  dolarMetni,
  googleOzeti,
  HAFTA_GRAFIGI,
  haftaCubuklari,
  icerikDurumu,
  type Genel,
  type IcerikSehri,
} from '@/features/yonetim/genelBakis';
import { ty } from '@/features/yonetim/metin';
import { binlik } from '@/features/yonetim/yer';
import { yazi } from '@/theme';

import { Kart, KartEtiketi, Rozet } from '../Ortak';
import { yRenk } from '../tema';

/** Gösterge kartı (kanvas BO-0 üst sıra): etiket, Archivo 34 değer, 13 px alt satır; veri yoksa "veri bekleniyor". */
export function GostergeKarti({ baslik, deger, alt, bekleniyor }: { baslik: string; deger: string; alt?: ReactNode; bekleniyor?: boolean }) {
  return (
    <Kart style={s.gosterge}>
      <KartEtiketi>{baslik}</KartEtiketi>
      {bekleniyor ? <Text style={s.bekleniyor}>{ty('genel.veriBekleniyor')}</Text> : <Text style={s.deger}>{deger}</Text>}
      {alt ? <View style={s.altSatir}>{alt}</View> : null}
    </Kart>
  );
}

/** Alt satır metni; `vurgu` parçası koyu yeşil kalın (kanvas "katılım %61", "+%18"). */
export function AltMetin({ once, vurgu, sonra, vurguRengi = yRenk.basariMetin }: { once?: string; vurgu?: string | null; sonra?: string; vurguRengi?: string }) {
  return (
    <Text style={s.alt}>
      {once}
      {vurgu ? <Text style={[s.altVurgu, { color: vurguRengi }]}>{vurgu}</Text> : null}
      {sonra}
    </Text>
  );
}

export { Rozet };

/** KK3 "BU HAFTA" (kanvas 660 × 272): günlere göre kurulan plan (Gece) ve davetle katılım (Mandalina) çubukları. */
export function HaftaGrafigi({ hafta, bekleniyor }: { hafta: Genel['hafta']; bekleniyor: boolean }) {
  const G = HAFTA_GRAFIGI;
  const cubuklar = haftaCubuklari(hafta);
  return (
    <Kart style={s.grafikKart}>
      <View style={s.grafikUst}>
        <KartEtiketi>{ty('genel.hafta.baslik')}</KartEtiketi>
        <View style={s.lejant}>
          <Lejant renk={yRenk.ana} etiket={ty('genel.hafta.plan')} />
          <Lejant renk={yRenk.vurgu} etiket={ty('genel.hafta.katilim')} />
        </View>
      </View>
      <View style={s.grafik}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${G.genislik} ${G.yukseklik}`} accessibilityLabel={ty('genel.hafta.etiket')} role="img">
          <Path d={`M30 ${G.taban} H650`} stroke={yRenk.ayrac} strokeWidth={2} />
          <Path d="M30 160 H650 M30 80 H650" stroke={yRenk.yuzey} strokeWidth={2} />
          {cubuklar.map((c) => (
            <SvgCubuk key={c.gun} c={c} />
          ))}
        </Svg>
        {bekleniyor ? (
          <View style={s.grafikBekleniyor}>
            <Text style={s.bekleniyorKucuk}>{ty('genel.veriBekleniyor')}</Text>
          </View>
        ) : null}
      </View>
    </Kart>
  );
}

function SvgCubuk({ c }: { c: ReturnType<typeof haftaCubuklari>[number] }) {
  const G = HAFTA_GRAFIGI;
  return (
    <>
      {c.plan.h ? <Rect x={c.plan.x} y={c.plan.y} width={G.cubuk} height={c.plan.h} rx={8} fill={yRenk.ana} /> : null}
      {c.katilim.h ? <Rect x={c.katilim.x} y={c.katilim.y} width={G.cubuk} height={c.katilim.h} rx={8} fill={yRenk.vurgu} /> : null}
      <SvgText x={c.plan.x + G.cubuk + G.ara / 2} y={262} textAnchor="middle" fontFamily={yazi.ekstra} fontSize={13} fill={yRenk.soluk}>
        {c.etiket}
      </SvgText>
    </>
  );
}

function Lejant({ renk, etiket }: { renk: string; etiket: string }) {
  return (
    <View style={s.lejantOge}>
      <View style={[s.lejantKare, { backgroundColor: renk }]} />
      <Text style={s.lejantMetin}>{etiket}</Text>
    </View>
  );
}

/** KK4 "GOOGLE API · BUGÜN": tahmini harcama / günlük bütçe; kalem çubukları (bütçedeki pay); yorumlar n / sınır. */
export function GoogleKarti({ google }: { google: Genel['google'] }) {
  const o = googleOzeti(google);
  return (
    <Kart style={s.googleKart}>
      <KartEtiketi>{ty('genel.google.baslik')}</KartEtiketi>
      <View style={s.harcama}>
        <Text style={s.deger}>{dolarMetni(o.toplam)}</Text>
        <Text style={s.alt}>{o.butce ? ty('genel.google.butce', { butce: dolarMetni(o.butce).replace(',00', '') }) : ty('genel.google.butceYok')}</Text>
      </View>
      {o.asildi ? <Rozet tur="hata" etiket={ty('genel.google.asildi')} /> : null}
      {o.kalemler.map((k) => (
        <Cubuk key={k.anahtar} etiket={ty(`genel.google.kalem.${k.anahtar}`)} deger={binlik(k.sayi)} oran={k.oran} renk={yRenk.ana} />
      ))}
      <Cubuk
        etiket={ty('genel.google.kalem.yorum')}
        deger={o.yorum.sinir !== null ? ty('genel.google.yorumSinir', { n: binlik(o.yorum.sayi), sinir: binlik(o.yorum.sinir) }) : ty('genel.veriBekleniyor')}
        oran={o.yorum.oran}
        renk={yRenk.vurgu}
      />
      <Text style={s.not}>{ty('genel.google.tahmin')}</Text>
      <Link href="/yonetim/ayarlar" asChild>
        <Pressable accessibilityRole="link">
          <Text style={s.baglanti}>{ty('genel.google.sinirlar')}</Text>
        </Pressable>
      </Link>
    </Kart>
  );
}

function Cubuk({ etiket, deger, oran, renk }: { etiket: string; deger: string; oran: number; renk: string }) {
  return (
    <View style={s.cubukKap}>
      <View style={s.cubukUst}>
        <Text style={s.cubukEtiket}>{etiket}</Text>
        <Text style={s.cubukDeger}>{deger}</Text>
      </View>
      <View style={s.iz}>
        <View style={[s.dolu, { width: `${Math.round(oran * 100)}%`, backgroundColor: renk }]} />
      </View>
    </View>
  );
}

/** KK5 "EN ÇOK ALINAN GEZİLER": ilk 3; 48 px kapak, ad, "128 kez", Mandalina çubuk (en çoka göre). */
export function EnCokAlinanlar({ geziler }: { geziler: Genel['en_cok_alinan'] }) {
  const enCok = Math.max(1, ...geziler.map((g) => g.sayi));
  const renkler = ['#c9d2f2', '#ffe2cc', '#dce6ff'];
  return (
    <Kart style={s.esitKart}>
      <KartEtiketi>{ty('genel.enCok.baslik')}</KartEtiketi>
      {geziler.length === 0 ? <Text style={s.alt}>{ty('genel.enCok.bos')}</Text> : null}
      {geziler.map((g, i) => (
        <View key={g.id} style={s.geziSatir}>
          <View style={[s.kapak, { backgroundColor: renkler[i % renkler.length] }]}>
            {g.kapak_url ? <Image source={{ uri: g.kapak_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={s.geziMetin}>
            <View style={s.geziUst}>
              <Text numberOfLines={1} style={s.geziAd}>
                {g.baslik}
              </Text>
              <Text style={s.geziSayi}>{ty('genel.enCok.kez', { n: binlik(g.sayi) })}</Text>
            </View>
            <View style={[s.iz, s.izInce]}>
              <View style={[s.dolu, s.izInce, { width: `${Math.round((g.sayi / enCok) * 100)}%`, backgroundColor: yRenk.vurgu }]} />
            </View>
          </View>
        </View>
      ))}
    </Kart>
  );
}

/** KK6 "İÇERİK SAĞLIĞI": yayındaki her şehir — yeşil (tamam, özet) ya da turuncu (ilk eksik) satır, Düzenle. */
export function IcerikSagligi({ sehirler }: { sehirler: IcerikSehri[] }) {
  return (
    <Kart style={s.esitKart}>
      <KartEtiketi>{ty('genel.icerik.baslik')}</KartEtiketi>
      {sehirler.length === 0 ? <Text style={s.alt}>{ty('genel.icerik.bos')}</Text> : null}
      {sehirler.map((sh) => {
        const d = icerikDurumu(sh);
        return (
          <View key={sh.id} style={[s.saglik, { backgroundColor: d.tamam ? '#f4f6fa' : yRenk.bekliyorZemin }]}>
            <View style={[s.nokta, { backgroundColor: d.tamam ? yRenk.basari : yRenk.vurgu }]} />
            <View style={s.saglikMetin}>
              <Text style={s.saglikAd}>{sh.ad}</Text>
              <Text style={s.saglikAlt}>{ty(`genel.icerik.${d.anahtar}`, { n: d.n ?? 0, bolum: sh.bolum, mekan: sh.mekan, gezi: sh.gezi })}</Text>
            </View>
            <Link href={`/yonetim/sehirler?id=${sh.id}` as never} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={`${sh.ad} · ${ty('genel.icerik.duzenle')}`} style={s.duzenle}>
                <Text style={s.duzenleMetin}>{ty('genel.icerik.duzenle')}</Text>
              </Pressable>
            </Link>
          </View>
        );
      })}
    </Kart>
  );
}

const s = StyleSheet.create({
  gosterge: { flex: 1, minWidth: 220, gap: 10 },
  deger: { fontFamily: yazi.baslik, fontSize: 34, lineHeight: 36, letterSpacing: -1.02, color: yRenk.metin },
  bekleniyor: { fontFamily: yazi.baslik, fontSize: 20, lineHeight: 36, letterSpacing: -0.4, color: yRenk.yerTutucu },
  bekleniyorKucuk: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.ikincil },
  altSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  altVurgu: { fontFamily: yazi.ekstra },
  grafikKart: { flex: 1.6, minWidth: 420, gap: 10 },
  grafikUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lejant: { flexDirection: 'row', gap: 14 },
  lejantOge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lejantKare: { width: 12, height: 12, borderRadius: 4 },
  lejantMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  grafik: { width: '100%', aspectRatio: 660 / 272 },
  grafikBekleniyor: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  googleKart: { flex: 1, minWidth: 300, gap: 10 },
  harcama: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cubukKap: { gap: 6 },
  cubukUst: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cubukEtiket: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  cubukDeger: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  iz: { height: 8, borderRadius: 4, backgroundColor: yRenk.yuzey, overflow: 'hidden' },
  izInce: { height: 6, borderRadius: 3 },
  dolu: { height: 8, borderRadius: 4 },
  not: { fontFamily: yazi.normal, fontSize: 11.5, color: yRenk.soluk },
  baglanti: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.ana },
  esitKart: { flex: 1, minWidth: 320, gap: 10 },
  geziSatir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kapak: { width: 48, height: 48, flexShrink: 0, borderRadius: 14, overflow: 'hidden' },
  geziMetin: { flex: 1, minWidth: 0, gap: 6 },
  geziUst: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  geziAd: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin },
  geziSayi: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.ana },
  saglik: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  nokta: { width: 10, height: 10, borderRadius: 5 },
  saglikMetin: { flex: 1, minWidth: 0 },
  saglikAd: { fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin },
  saglikAlt: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  duzenle: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: yRenk.zemin, justifyContent: 'center' },
  duzenleMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.ana },
});
