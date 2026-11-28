// #408 KK1 (UX önerileri kanvası `Sayfa_v6_HazirGezi_Harita`): hazır gezi sayfasının üstünde 330 px harita (durum çubuğu
// dahil). Bütün günlerin durakları haritada; seçili gün numaralı köşeli kare pinler ve rotasıyla öne çıkar, diğer günler soluk
// nokta (docs/05 §2 "Diğer gün durağı"; rotaları çizilmez, §3). Renkler #310'un yeni gün renkleri (`yeniGunRengi`). Üstte
// 40 px beyaz daireler: solda geri, sağda paylaş ve ♥. Altında gün düğmeleri (34 px hap; seçili Lacivert zemin, beyaz yazı,
// gün renginde 8 px nokta). Harita dokunuşa kapalı (sayfa kaydırması haritada takılmasın; Seyahat v7'deki gibi).
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Harita } from '@/components/harita/Harita';
import type { HaritaCizgisi } from '@/components/harita/tipler';
import { useKayitli } from '@/components/icerik/Kalp';
import { BolumSiniri } from '@/components/ui/BolumSiniri';
import { Ikon } from '@/components/ui/Ikon';
import { geziGunCizgileri, hazirGeziPinleri } from '@/features/icerik/gezi';
import { useGeziRotasi } from '@/features/icerik/geziRota';
import { useKaydet } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import type { GeziDetay } from '@/lib/tipler';
import { hazirGeziV6, renk, seyahatV7, yazi, yeniGunRengi } from '@/theme';

type Props = {
  gezi: GeziDetay;
  gunSira: number;
  onGunSira: (i: number) => void;
  onGeri: () => void;
  onPaylas: () => void;
};

export function HazirGeziHaritasi({ gezi, gunSira, onGunSira, onGeri, onPaylas }: Props) {
  const ust = useSafeAreaInsets().top;
  const gun = gezi.gezi_gunleri[gunSira] ?? gezi.gezi_gunleri[0];
  const { rotalar } = useGeziRotasi(gun);
  const pinler = useMemo(() => hazirGeziPinleri(gezi, gunSira), [gezi, gunSira]);
  const cizgiler = useMemo<HaritaCizgisi[]>(() => (gun ? geziGunCizgileri(gun.gezi_duraklari, gun.sira, rotalar, yeniGunRengi(gun.sira)) : []), [gun, rotalar]);
  // Kadraj seçili günün durakları; konumlu durağı yoksa bütün gezi.
  const seciliNoktalar = pinler.filter((p) => p.etiket).map((p) => p.konum);
  const noktalar = seciliNoktalar.length > 0 ? seciliNoktalar : pinler.map((p) => p.konum);
  const merkez = noktalar[0] ?? { lat: 39.78, lng: 30.52 };
  const dugmeUst = Math.max(ust, 12) + 8;
  const cipUst = dugmeUst + 40 + 16;
  return (
    <View style={s.harita} testID="hazir-gezi-harita">
      {noktalar.length > 0 ? (
        // #199 KK3: harita hata verirse yalnız harita "açılamadı" kartına döner; geri / paylaş / ♥ ve gün düğmeleri çalışır.
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <BolumSiniri ad="gezi-harita" sifirla={gun?.id}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Harita merkez={merkez} zoom={13} pinler={pinler} cizgiler={cizgiler} sigdir={{ noktalar, ust: cipUst + 34 + 16, alt: 24 }} />
            </View>
          </BolumSiniri>
        </View>
      ) : null}
      <View style={[s.dugmeler, { paddingTop: dugmeUst }]} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={onGeri} style={s.daire} hitSlop={2}>
          <Ikon ad="geri" boyut={20} renk={renk.metin} kalinlik={2.4} />
        </Pressable>
        <View style={s.sag}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('gezi.paylas')} onPress={onPaylas} style={s.daire} hitSlop={2}>
            <Ikon ad="paylasV7" boyut={18} renk={renk.metin} kalinlik={2.2} />
          </Pressable>
          <KalpDugmesi geziId={gezi.id} boyut={18} stil={s.daire} />
        </View>
      </View>
      {gezi.gezi_gunleri.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[s.ciplerSerit, { top: cipUst }]}
          contentContainerStyle={s.cipler}
          accessibilityRole="tablist"
          accessibilityLabel={t('gezi.v6.gunler')}>
          {gezi.gezi_gunleri.map((g, i) => {
            const secili = i === gunSira;
            return (
              <Pressable key={g.id} accessibilityRole="tab" accessibilityState={{ selected: secili }} onPress={() => onGunSira(i)} style={[s.cip, secili && s.cipSecili]} hitSlop={{ top: 5, bottom: 5 }}>
                <View style={[s.cipNokta, { backgroundColor: yeniGunRengi(g.sira) }]} />
                <Text style={[s.cipMetin, secili && s.cipMetinSecili]}>{t('gezi.gunKisa', { n: g.sira })}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

/**
 * ♥ (kanvas: harita üstünde 40 px beyaz dairede 18 px; kaydırınca 36 px alanda 20 px, dairesiz). Boş: Lacivert 2,2 çizgi;
 * kayıtlı: Mandalina dolgu (`Kalp` ile aynı). Kaydedilenler'e yazar.
 */
export function KalpDugmesi({ geziId, boyut, stil }: { geziId: string; boyut: number; stil: object }) {
  const kayitli = useKayitli('gezi', geziId);
  const kaydet = useKaydet();
  return (
    <Pressable accessibilityRole="togglebutton" accessibilityLabel={t('gezi.kaydet')} accessibilityState={{ checked: kayitli }} onPress={() => kaydet.mutate({ tur: 'gezi', hedef_id: geziId, kayitli })} style={stil} hitSlop={4}>
      <Ikon ad={kayitli ? 'kalpDolu' : 'kalp'} boyut={boyut} renk={kayitli ? renk.vurgu : renk.metin} kalinlik={2.2} />
    </Pressable>
  );
}

const golge = { shadowColor: renk.metin, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 } as const;

const s = StyleSheet.create({
  harita: { height: hazirGeziV6.haritaBoy, backgroundColor: seyahatV7.haritaZemin, overflow: 'hidden' },
  dugmeler: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  sag: { flexDirection: 'row', gap: 10 },
  daire: { width: 40, height: 40, borderRadius: 20, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center', ...golge },
  ciplerSerit: { position: 'absolute', left: 0, right: 0, flexGrow: 0 },
  cipler: { gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  cip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: renk.zemin, flexDirection: 'row', alignItems: 'center', gap: 6, ...golge, shadowColor: hazirGeziV6.cipGolge, shadowOpacity: 1 },
  cipSecili: { backgroundColor: renk.metin },
  cipNokta: { width: 8, height: 8, borderRadius: 4 },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  cipMetinSecili: { color: renk.zemin },
});
