// #182 KK1–KK6 (kanvas 24): Plan sekmesi "liste önce" — üstte "‹ {seyahat}" + kişiler, "Plan" + Sırayı düzenle, gün çipleri
// (+ gün ekle), 112 px harita şeridi, seçili günün başlığı (çıkış saati), duraklar ve aralarında bacak satırları (yürüme / araç
// ikonu + süre), gün sonunda boşluk varsa sessiz "Akşam boş" önerisi. Durağa dokununca mekan paneli (mevcut).
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import type { Gun, Uye } from '@/lib/tipler';
import { gunUstuMetin, renk, yazi, yuzRenkleri } from '@/theme';

export type PlanSatirGorunumu = {
  id: string;
  mekanId: string;
  numara: number | null;
  numaraRengi: string;
  saat: string | null;
  sure: string;
  ad: string;
  alt: string;
  foto: string | null;
  fotoZemin: string;
  /** Önceki noktadan bacak: "12 dk" / "~6 dk · otelden"; yoksa null. */
  gelis: { metin: string; araba: boolean } | null;
  /** Gezi modunda şu anki (buradasın / sıradaki) durak. */
  vurgulu: boolean;
  gecildi: boolean;
  atlandi: boolean;
};

type Props = {
  baslik: string;
  uyeler: Uye[];
  onGeri: () => void;
  onGrup: () => void;
  onSirala: () => void;
  gunler: Gun[];
  seciliGunId: string | undefined;
  gunEtiketi: (g: Gun) => string;
  gunRengi: (g: Gun) => string;
  durakSayisi: (g: Gun) => number;
  onGunSec: (g: Gun) => void;
  onGunUzunBas: (g: Gun) => void;
  onGunEkle: () => void;
  serit: ReactNode;
  gun: { renk: string; index: number; baslik: string; cikis: string; onCikis: () => void } | null;
  satirlar: PlanSatirGorunumu[];
  onDurak: (mekanId: string) => void;
  onDurakUzunBas: (mekanId: string) => void;
  aksam: { kalin: string; metin: string; onOner: () => void } | null;
  bos: { metin: string; dugme: string; onPress: () => void } | null;
  uyari: string | null;
};

export function PlanListesi(p: Props) {
  const ust = useSafeAreaInsets().top;
  return (
    <ScrollView style={s.ekran} contentContainerStyle={{ paddingTop: ust + 8, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <View style={s.ust}>
        <View style={s.satirArasi}>
          <View style={{ flexShrink: 1 }}>
            <GeriHapi baslik={p.baslik} onPress={p.onGeri} duz />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('geziSayfasi.seyahattekiler')} onPress={p.onGrup} hitSlop={6} style={{ flexDirection: 'row' }}>
            {p.uyeler.slice(0, 4).map((u, i) => (
              <View key={u.user_id} style={[s.yuz, i > 0 && { marginLeft: -8 }]}>
                <Avatar ad={u.display_name} url={u.photo_url} boyut={28} arkaPlan={yuzRenkleri[i % yuzRenkleri.length]} />
              </View>
            ))}
          </Pressable>
        </View>
        <View style={[s.satirArasi, { alignItems: 'baseline' }]}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('plan.baslik')}
          </Text>
          <Pressable accessibilityRole="button" onPress={p.onSirala} hitSlop={6} style={({ pressed }) => [s.sirala, pressed && { opacity: 0.8 }]}>
            <Ikon ad="sirala" boyut={14} renk={renk.ana} kalinlik={2.3} />
            <Text style={s.siralaMetin}>{t('plan.sirayiDuzenle')}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={s.cipler}>
          {p.gunler.map((g) => {
            const secili = g.id === p.seciliGunId;
            const renkGun = p.gunRengi(g);
            const dolu = p.durakSayisi(g) > 0;
            return (
              <Pressable
                key={g.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: secili }}
                onPress={() => p.onGunSec(g)}
                onLongPress={() => p.onGunUzunBas(g)}
                style={[s.cip, secili && { backgroundColor: renkGun }]}>
                {!secili && dolu ? <View style={[s.nokta, { backgroundColor: renkGun }]} /> : null}
                <Text style={[s.cipMetin, secili ? { color: gunUstuMetin(renkGun) } : !dolu && { color: renk.ikincil }]}>{p.gunEtiketi(g)}</Text>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel={t('plan.gunEkle')} onPress={p.onGunEkle} style={s.ekle}>
            <Ikon ad="arti" boyut={16} renk={renk.ana} kalinlik={3} />
          </Pressable>
        </ScrollView>
      </View>

      <View style={s.serit}>{p.serit}</View>

      <View style={s.liste}>
        {p.uyari ? <Text style={s.uyari}>{p.uyari}</Text> : null}
        {p.gun ? (
          <View style={s.gunBaslik}>
            <View style={[s.gunNo, { backgroundColor: p.gun.renk }]}>
              <Text style={[s.gunNoMetin, { color: gunUstuMetin(p.gun.renk) }]}>{p.gun.index}</Text>
            </View>
            <Text style={s.gunBaslikMetin} numberOfLines={1}>
              {p.gun.baslik}
            </Text>
            <Pressable accessibilityRole="button" onPress={p.gun.onCikis} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <Text style={s.cikis}>{p.gun.cikis}</Text>
            </Pressable>
          </View>
        ) : null}
        {p.satirlar.map((r) => (
          <View key={r.id} style={{ gap: 4 }}>
            {r.gelis ? (
              <View style={s.bacak}>
                <View style={s.bacakCizgi} />
                <Ikon ad={r.gelis.araba ? 'araba' : 'yuru'} boyut={14} renk={renk.ana} kalinlik={2.4} />
                <Text style={s.bacakMetin}>{r.gelis.metin}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => p.onDurak(r.mekanId)}
              onLongPress={() => p.onDurakUzunBas(r.mekanId)}
              style={({ pressed }) => [s.durak, r.vurgulu && s.durakVurgulu, r.atlandi && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}>
              <View
                style={[
                  s.no,
                  { backgroundColor: r.gecildi ? renk.basari : r.vurgulu ? renk.vurgu : r.numaraRengi },
                  r.vurgulu && { borderWidth: 2.5, borderColor: renk.ana },
                ]}>
                <Text style={[s.noMetin, { color: r.vurgulu ? renk.metin : r.gecildi ? renk.zemin : gunUstuMetin(r.numaraRengi) }]}>{r.gecildi ? '✓' : (r.numara ?? '–')}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.saatSatiri}>
                  <Text style={s.saat}>{r.atlandi ? t('plan.atlandi') : r.saat}</Text>
                  <Text style={s.sure}>{r.sure}</Text>
                </View>
                <Text style={[s.ad, r.atlandi && s.cizili]} numberOfLines={2}>
                  {r.ad}
                </Text>
                {r.alt ? (
                  <Text style={s.alt} numberOfLines={1}>
                    {r.alt}
                  </Text>
                ) : null}
              </View>
              <View style={[s.foto, { backgroundColor: r.fotoZemin }]}>{r.foto ? <Image source={{ uri: r.foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}</View>
            </Pressable>
          </View>
        ))}
        {p.bos ? (
          <View style={s.bos}>
            <Text style={s.bosMetin}>{p.bos.metin}</Text>
            <Pressable accessibilityRole="button" onPress={p.bos.onPress} hitSlop={6}>
              <Text style={s.bosDugme}>{p.bos.dugme}</Text>
            </Pressable>
          </View>
        ) : null}
        {p.aksam ? (
          <View style={s.aksam}>
            <Text style={s.aksamMetin}>
              <Text style={{ fontFamily: yazi.ekstra, color: renk.metin }}>{`${p.aksam.kalin} `}</Text>
              {p.aksam.metin}
            </Text>
            <Pressable accessibilityRole="button" onPress={p.aksam.onOner} style={({ pressed }) => [s.oner, pressed && { opacity: 0.85 }]}>
              <Ikon ad="arti" boyut={16} renk={renk.metin} kalinlik={2.3} />
              <Text style={s.onerMetin}>{t('plan.oner')}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.haritaZemin },
  ust: { paddingHorizontal: 20, gap: 12 },
  satirArasi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  yuz: { borderWidth: 2, borderColor: renk.zemin, borderRadius: 10 },
  baslik: { fontFamily: yazi.baslik, fontSize: 28, letterSpacing: -0.84, color: renk.metin },
  sirala: { height: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: renk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 5 },
  siralaMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  cipler: { paddingHorizontal: 20, gap: 6 },
  cip: { height: 36, paddingHorizontal: 12, borderRadius: 11, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 6 },
  nokta: { width: 8, height: 8, borderRadius: 4 },
  cipMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  ekle: { width: 36, height: 36, borderRadius: 11, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  serit: { marginTop: 14, marginHorizontal: 20 },
  liste: { paddingTop: 14, paddingHorizontal: 20, gap: 4 },
  uyari: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingBottom: 6 },
  gunBaslik: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2, paddingBottom: 8 },
  gunNo: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  gunNoMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  gunBaslikMetin: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  cikis: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bacak: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, paddingLeft: 16 },
  bacakCizgi: { width: 2, height: 18, backgroundColor: renk.ayrac, marginRight: 6 },
  bacakMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  durak: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 16, backgroundColor: renk.zemin },
  durakVurgulu: { borderWidth: 2, borderColor: renk.vurgu, padding: 10 },
  no: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  noMetin: { fontFamily: yazi.ekstra, fontSize: 13 },
  saatSatiri: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  saat: { fontFamily: yazi.baslik, fontSize: 15, color: renk.metin },
  sure: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  ad: { fontFamily: yazi.ekstra, fontSize: 15, lineHeight: 18, color: renk.metin, marginTop: 2 },
  cizili: { textDecorationLine: 'line-through' },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, marginTop: 2 },
  foto: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
  bos: { padding: 14, borderRadius: 16, backgroundColor: renk.zemin, gap: 8 },
  bosMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.ikincil },
  bosDugme: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  aksam: { marginTop: 8, padding: 12, borderRadius: 16, backgroundColor: '#fff6e6', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#ffd9bf', flexDirection: 'row', alignItems: 'center', gap: 10 },
  aksamMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
  oner: { height: 34, paddingHorizontal: 14, borderRadius: 12, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', gap: 6 },
  onerMetin: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 16, color: renk.metin },
});
