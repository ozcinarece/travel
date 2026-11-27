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

/** Kanvas `Plan_v7p_*`: yuvarlak düğme zemini ("Atlandı" hapı da). */
const DUGME_ZEMIN = '#F2F4F8';
/** #554 (kanvas `Plan_v7p_Haller` 2): atlanan durağın kesik çizgili dairesi. */
const ATLANAN_KENAR = anaV5.ok;

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
  /** #558: vurgulu durak "buradasın" durumunda (sıradaki değil). */
  buradasin: boolean;
  gecildi: boolean;
  atlandi: boolean;
};

type Props = {
  /** #554 KK1: gezi günü (bugün) — sıradakinden sonraki duraklar çerçeveli daire. */
  bugun: boolean;
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
  /** #554 KK3: günde hiç durak yoksa boş gün hali ("{gün} henüz boş" + turuncu "+ Bu güne yer ekle"). */
  bosGun: { baslik: string } | null;
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
        {p.bosGun ? (
          <View style={s.bos}>
            <Text style={s.bosBaslik}>{p.bosGun.baslik}</Text>
            <Text style={s.bosMetin}>{t('plan.bosGunMetin')}</Text>
          </View>
        ) : null}
        {p.bosGun && p.onEkle ? (
          <Pressable accessibilityRole="button" onPress={p.onEkle} style={({ pressed }) => [s.bosDugme, pressed && { opacity: 0.85 }]}>
            <Ikon ad="artiV7" boyut={18} renk={renk.metin} kalinlik={2.4} />
            <Text style={s.bosDugmeMetin}>{t('plan.buGuneEkle')}</Text>
          </Pressable>
        ) : null}
        {p.satirlar.map((r, i) => {
          const soluk = r.gecildi || r.atlandi;
          const daire = daireTuru(r, p.bugun);
          const siradaki = r.vurgulu && !r.buradasin;
          return (
            <View key={r.id}>
              {/* #554 KK2 (pano 2): atlanan durağa bacak bilgisi yok; kısa kesik çizgi. */}
              {!r.gelis && r.atlandi && i > 0 ? (
                <View style={s.bacak}>
                  <View style={s.saatSutunu} />
                  <View style={[s.kesikSutun, { height: 12 }]}>
                    {[0, 1].map((i) => (
                      <View key={i} style={s.kesik} />
                    ))}
                  </View>
                </View>
              ) : null}
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
                <Text style={[s.saat, r.vurgulu && { color: renk.metin }]}>{r.saat ?? ''}</Text>
                {daire === 'tik' ? (
                  <View style={[s.no, { backgroundColor: seyahatV7.tikZemin }]}>
                    <Ikon ad="tik" boyut={15} renk={renk.basari} kalinlik={2.4} />
                  </View>
                ) : daire === 'kesik' ? (
                  <View style={[s.no, s.noKesik]}>
                    <Text style={[s.noMetin, { color: anaV5.ikincil }]}>{r.numara ?? '–'}</Text>
                  </View>
                ) : daire === 'cerceve' ? (
                  <View style={[s.no, s.noCerceve, { borderColor: r.numaraRengi }]}>
                    <Text style={[s.noMetin, { color: renk.metin }]}>{r.numara ?? '–'}</Text>
                  </View>
                ) : (
                  <View style={[s.no, { backgroundColor: r.numaraRengi }]}>
                    <Text style={[s.noMetin, { color: gunUstuMetin(r.numaraRengi) }]}>{r.numara ?? '–'}</Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  {siradaki ? <Text style={s.rozet}>{t('plan.siradakiRozet')}</Text> : null}
                  <Text style={[s.ad, soluk && { color: anaV5.ikincil }]} numberOfLines={2}>
                    {r.ad}
                  </Text>
                  {r.alt ? (
                    <Text style={s.alt} numberOfLines={1}>
                      {r.alt}
                    </Text>
                  ) : null}
                </View>
                {r.atlandi ? (
                  <View style={s.hap}>
                    <Text style={s.hapMetin}>{t('plan.atlandi')}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
        {p.onEkle && !p.bosGun ? (
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
        {p.listem ? <ListemBekliyorSatiri n={p.listem.n} onPress={p.listem.onPress} bosGun={!!p.bosGun} /> : null}
      </View>
    </ScrollView>
  );
}

/** #534 KK7: "Listem · N yer gün bekliyor ›"; liste ve (#553 KK5) harita görünümünün paneli ortak kullanır. */
export function ListemBekliyorSatiri({ n, onPress, bosGun }: { n: number; onPress: () => void; bosGun?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.listem, bosGun && { marginTop: 22 }, pressed && { opacity: 0.8 }]}>
      <Ikon ad="kalpV7" boyut={20} renk={renk.ana} kalinlik={2} />
      <Text style={s.listemBaslik}>{t('plan.listem')}</Text>
      <Text style={s.listemAlt}>{t('plan.listemBekliyor', { n })}</Text>
      <Ikon ad="okV7p" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
    </Pressable>
  );
}

/** #553 KK1 (#558): sekme kutusu 44 pt — `hitSlop` üst kabı aşamadığı için dokunma alanı kutunun kendisi. */
export const SEKME_YUKSEKLIK = 44;

/** #553 KK2: ekran okuyucu etiketi — saat, ad, alt satır; vurgulu durakta "şu an buradasın" ya da "sıradaki durak";
 * #554 KK2: atlananda "Atlandı" hapı da okunur (alt satırdaki "· atlandı" kalktı). */
export function durakEtiketi(r: { saat: string | null; ad: string; alt: string | null; vurgulu: boolean; buradasin?: boolean; atlandi?: boolean }): string {
  const durum = r.vurgulu ? t(r.buradasin ? 'plan.buradasinDurak' : 'plan.siradakiDurak') : r.atlandi ? t('plan.atlandi') : null;
  return [r.saat, r.ad, r.alt, durum].filter(Boolean).join(', ');
}

/**
 * #554 KK1–KK2 (kanvas `Plan_v7p_Haller` 1–2): numara dairesi. Gezilen yeşil ✓; atlanan kesik çizgili gri; bugünde şu anki /
 * sıradaki durak gün renginde dolu, sonrakiler gün rengi çerçeveli beyaz; plan gününde hepsi dolu (`Plan_v7p_Gun`).
 */
export function daireTuru(r: { gecildi: boolean; atlandi: boolean; vurgulu: boolean }, bugun: boolean): 'tik' | 'kesik' | 'dolu' | 'cerceve' {
  if (r.gecildi) return 'tik';
  if (r.atlandi) return 'kesik';
  if (bugun && !r.vurgulu) return 'cerceve';
  return 'dolu';
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
  sekme: { height: SEKME_YUKSEKLIK, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
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
  noKesik: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: ATLANAN_KENAR, backgroundColor: renk.zemin },
  noCerceve: { borderWidth: 2, backgroundColor: renk.zemin },
  rozet: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.24, color: anaV5.adim },
  hap: { height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: DUGME_ZEMIN, justifyContent: 'center' },
  hapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: anaV5.ikincil },
  bos: { paddingTop: 22, paddingBottom: 18, gap: 6 },
  bosBaslik: { fontFamily: yazi.ekstra, fontSize: 19, color: renk.metin },
  bosMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: anaV5.ikincil },
  bosDugme: { height: 52, borderRadius: 26, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bosDugmeMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
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
