// #534 Plan gün ekranı v7p (UX önerileri kanvası `Plan_v7p_Bugun` · `Plan_v7p_Gun`): liste önde, üst harita yok. Üstte "Plan"
// 28/800 + iki yuvarlak düğme (harita → tam harita, ⋯ → Sırayı düzenle ve gün ayarları), altı çizili gün sekmeleri (gün renginde
// 7 px nokta, etkin çizgi turuncu), gün özeti, tek "Otel ekle" satırı (otel varsa çıkış saati), saat sütunlu durak satırları,
// aralarında tek gri bacak satırı, "+ Bu güne yer ekle", bugünde "Akşam için yakında", en altta "Listem · N yer gün bekliyor ›".
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BolumBasligi, BugunBosV7, type BosGunYeri } from '@/components/gezi/SeyahatV7';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import type { Gun } from '@/lib/tipler';
import { altMenuRenk, anaV5, gunUstuMetin, renk, seyahatV7, yazi } from '@/theme';

/** Kanvas `Plan_v7p_*`: yuvarlak düğme zemini. */
const DUGME_ZEMIN = '#F2F4F8';

export type PlanSatirGorunumu = {
  id: string;
  mekanId: string;
  numara: number | null;
  numaraRengi: string;
  /** Varış saati ("09:00"); atlananda null. */
  saat: string | null;
  ad: string;
  /** "tür · süre" (gezildiyse "· gezildi"). */
  alt: string;
  /** Önceki noktadan bacak: "9 dk · 3,2 km"; yoksa null. */
  gelis: { metin: string; araba: boolean } | null;
  /** Gezi modunda şu anki (buradasın / sıradaki) durak. */
  vurgulu: boolean;
  gecildi: boolean;
  atlandi: boolean;
};

type Props = {
  onHarita: () => void;
  onDaha: () => void;
  gunler: Gun[];
  seciliGunId: string | undefined;
  /** Sekme metni: bugün "Bugün", diğerleri "Cum 27". */
  sekmeEtiketi: (g: Gun) => string;
  gunRengi: (g: Gun) => string;
  onGunSec: (g: Gun) => void;
  onGunUzunBas: (g: Gun) => void;
  /** KK3: "Perşembe · 26 Kasım" ve "Kurşunlu · 09:00–12:58 · 2 durak". */
  ozet: { baslik: string; alt: string } | null;
  /** KK4: otel yoksa "Otel ekle"; varsa otelden çıkış saati. */
  otel: { baslik: string; alt: string; onPress: () => void } | null;
  satirlar: PlanSatirGorunumu[];
  onDurak: (mekanId: string) => void;
  onDurakUzunBas: (mekanId: string) => void;
  /** KK7: "+ Bu güne yer ekle" (Yer ekle o gün seçili açılır). */
  onEkle: (() => void) | null;
  /** #532 KK3: "Akşam için yakında" — en çok 2 yer, + o günün sonuna ekler. */
  aksam: { yerler: BosGunYeri[]; eklenenler: Set<string>; onEkle: (id: string) => void; pasif?: boolean; onTumu: () => void } | null;
  /** KK7: "Listem · N yer gün bekliyor ›". */
  listem: { n: number; onPress: () => void } | null;
  uyari: string | null;
};

export function PlanListesi(p: Props) {
  const ust = useSafeAreaInsets().top;
  return (
    <ScrollView style={s.ekran} contentContainerStyle={{ paddingTop: ust + 8, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={s.ust}>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('plan.baslik')}
        </Text>
        <View style={s.dugmeler}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('plan.haritada')} onPress={p.onHarita} hitSlop={4} style={({ pressed }) => [s.yuvarlak, pressed && { opacity: 0.8 }]}>
            <Ikon ad="haritaV7p" boyut={19} renk={renk.metin} kalinlik={2} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('plan.diger')} onPress={p.onDaha} hitSlop={4} style={({ pressed }) => [s.yuvarlak, pressed && { opacity: 0.8 }]}>
            <Ikon ad="dahaV7" boyut={18} renk={renk.metin} kalinlik={2.2} />
          </Pressable>
        </View>
      </View>

      <View style={s.sekmeAlani}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sekmeler}>
          {p.gunler.map((g) => {
            const secili = g.id === p.seciliGunId;
            return (
              <Pressable
                key={g.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: secili }}
                onPress={() => p.onGunSec(g)}
                onLongPress={() => p.onGunUzunBas(g)}
                // #553 KK1: görünen 42 pt (kanvas), dokunma alanı 44 pt.
                hitSlop={SEKME_HIT_SLOP}
                style={[s.sekme, secili && s.sekmeSecili]}>
                <View style={[s.nokta, { backgroundColor: p.gunRengi(g) }]} />
                <Text style={[s.sekmeMetin, secili && s.sekmeMetinSecili]} numberOfLines={1}>
                  {p.sekmeEtiketi(g)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {p.ozet ? (
        <View style={s.ozet}>
          <Text style={s.ozetBaslik} numberOfLines={1}>
            {p.ozet.baslik}
          </Text>
          {p.ozet.alt ? (
            <Text style={s.ozetAlt} numberOfLines={1}>
              {p.ozet.alt}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={s.liste}>
        {p.uyari ? <Text style={s.uyari}>{p.uyari}</Text> : null}
        {p.otel ? (
          <Pressable accessibilityRole="button" onPress={p.otel.onPress} style={({ pressed }) => [s.otel, pressed && { opacity: 0.8 }]}>
            <Ikon ad="yatakV7p" boyut={20} renk={renk.ana} kalinlik={2} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.otelBaslik} numberOfLines={1}>
                {p.otel.baslik}
              </Text>
              <Text style={s.otelAlt} numberOfLines={1}>
                {p.otel.alt}
              </Text>
            </View>
            <Ikon ad="okV7p" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
          </Pressable>
        ) : null}
        {p.satirlar.map((r) => {
          const soluk = r.gecildi || r.atlandi;
          return (
            <View key={r.id}>
              {r.gelis ? (
                <View style={s.bacak} accessible accessibilityLabel={`${t(r.gelis.araba ? 'plan.bacakArac' : 'plan.bacakYuru')} ${r.gelis.metin}`}>
                  <View style={s.saatSutunu} />
                  <View style={s.kesikSutun}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={s.kesik} />
                    ))}
                  </View>
                  <View style={s.bacakBilgi}>
                    <Ikon ad={r.gelis.araba ? 'arabaV7p' : 'yuruV7p'} boyut={14} renk={anaV5.ikincil} kalinlik={1.8} />
                    <Text style={s.bacakMetin}>{r.gelis.metin}</Text>
                  </View>
                </View>
              ) : null}
              <Pressable
                // #553 KK2: sıradaki/şu anki durak `selected` değil (seçim anlamı taşır); durum etiketin sonunda.
                accessibilityRole="button"
                accessibilityLabel={durakEtiketi(r)}
                onPress={() => p.onDurak(r.mekanId)}
                onLongPress={() => p.onDurakUzunBas(r.mekanId)}
                style={({ pressed }) => [s.durak, pressed && { opacity: 0.85 }]}>
                <Text style={s.saat}>{r.saat ?? ''}</Text>
                {r.gecildi ? (
                  <View style={[s.no, { backgroundColor: seyahatV7.tikZemin }]}>
                    <Ikon ad="tik" boyut={15} renk={renk.basari} kalinlik={2.4} />
                  </View>
                ) : (
                  <View style={[s.no, { backgroundColor: r.atlandi ? anaV5.cizgi : r.numaraRengi }]}>
                    <Text style={[s.noMetin, { color: r.atlandi ? anaV5.ikincil : gunUstuMetin(r.numaraRengi) }]}>{r.numara ?? '–'}</Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Text style={[s.ad, soluk && { color: anaV5.ikincil }]} numberOfLines={2}>
                    {r.ad}
                  </Text>
                  {r.alt ? (
                    <Text style={s.alt} numberOfLines={1}>
                      {r.alt}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        })}
        {p.onEkle ? (
          <Pressable accessibilityRole="button" onPress={p.onEkle} style={({ pressed }) => [s.ekle, pressed && { opacity: 0.8 }]}>
            <View style={s.saatSutunu} />
            <View style={s.ekleDaire}>
              <Ikon ad="artiV7" boyut={15} renk={renk.ana} kalinlik={2.4} />
            </View>
            <Text style={s.ekleMetin}>{t('plan.buGuneEkle')}</Text>
          </Pressable>
        ) : null}
        {p.aksam ? (
          <View style={s.aksam}>
            <BolumBasligi baslik={t('plan.aksamYakinda')} baglanti={t('plan.tumu')} onBaglanti={p.aksam.onTumu} />
            <BugunBosV7 yerler={p.aksam.yerler} eklenenler={p.aksam.eklenenler} onEkle={p.aksam.onEkle} pasif={p.aksam.pasif} />
          </View>
        ) : null}
        {p.listem ? <ListemBekliyorSatiri n={p.listem.n} onPress={p.listem.onPress} /> : null}
      </View>
    </ScrollView>
  );
}

/** #534 KK7: "Listem · N yer gün bekliyor ›"; liste ve (#553 KK5) harita görünümünün paneli ortak kullanır. */
export function ListemBekliyorSatiri({ n, onPress }: { n: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.listem, pressed && { opacity: 0.8 }]}>
      <Ikon ad="kalpV7" boyut={20} renk={renk.ana} kalinlik={2} />
      <Text style={s.listemBaslik}>{t('plan.listem')}</Text>
      <Text style={s.listemAlt}>{t('plan.listemBekliyor', { n })}</Text>
      <Ikon ad="okV7p" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
    </Pressable>
  );
}

export const SEKME_HIT_SLOP = { top: 1, bottom: 1 } as const;

/** #553 KK2: ekran okuyucu etiketi — saat, ad, alt satır; sıradaki ya da şu anki durakta "sıradaki durak". */
export function durakEtiketi(r: { saat: string | null; ad: string; alt: string | null; vurgulu: boolean }): string {
  return [r.saat, r.ad, r.alt, r.vurgulu ? t('plan.siradakiDurak') : null].filter(Boolean).join(', ');
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  ust: { paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.28, color: renk.metin },
  dugmeler: { flexDirection: 'row', gap: 10 },
  yuvarlak: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DUGME_ZEMIN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: renk.metin,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  sekmeAlani: { borderBottomWidth: 1, borderBottomColor: altMenuRenk.cizgi },
  sekmeler: { paddingHorizontal: 16, gap: 20 },
  sekme: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  sekmeSecili: { borderBottomColor: renk.vurgu },
  nokta: { width: 7, height: 7, borderRadius: 4 },
  sekmeMetin: { fontFamily: yazi.orta, fontSize: 15, color: anaV5.ikincil },
  sekmeMetinSecili: { fontFamily: yazi.kalin, color: renk.metin },
  ozet: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 6, gap: 2 },
  ozetBaslik: { fontFamily: yazi.ekstra, fontSize: 20, color: renk.metin },
  ozetAlt: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  liste: { paddingHorizontal: 16 },
  uyari: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil, paddingVertical: 6 },
  otel: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: anaV5.cizgi, marginBottom: 6, minHeight: 44 },
  otelBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  otelAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  saatSutunu: { width: 44 },
  durak: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 44 },
  saat: { width: 44, fontFamily: yazi.kalin, fontSize: 14, color: anaV5.ikincil, fontVariant: ['tabular-nums'] },
  no: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noMetin: { fontFamily: yazi.ekstra, fontSize: 13 },
  ad: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  bacak: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kesikSutun: { width: 28, height: 22, alignItems: 'center', gap: 3 },
  kesik: { width: 2, height: 3, backgroundColor: anaV5.cizgi },
  bacakBilgi: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bacakMetin: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  ekle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44 },
  ekleDaire: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  ekleMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana },
  aksam: {},
  listem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, marginTop: 10, borderTopWidth: 1, borderTopColor: anaV5.cizgi },
  listemBaslik: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  listemAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
});
