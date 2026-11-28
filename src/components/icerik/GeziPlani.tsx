// #97 B → #143 → #408 KK3 (UX önerileri kanvası `Sayfa_v6_HazirGezi_Harita` · `Sayfa_v5_HazirGezi_Kayik`): hazır gezinin
// Plan sekmesi. Bütün günler alt alta; ilk gün başlıksız başlar (gün düğmeleri haritanın altında), sonraki günlerin başında
// "2. gün · Sazova ve Porsuk" (17/800) ve sağda "6 durak". Durak satırı: gün renginde 24 px numara dairesi (#310 yeni gün
// renkleri), 52 px foto ya da kamera, ad (15/700), "tür · süre" (13), sağda ince "+" ya da tik (`InceEkle`). Satırlar arasında
// 2 × 16 px çizgi ve "6 dk yürüyüş" / "12 dk araçla" (12). #192: süreler gerçek yoldan (gezi_rota_onbellek; gün başına bir kez
// hesaplanır, 30 gün saklanır); yol gelene kadar kestirim. Mini harita, gün çipleri ve gün özeti kalktı (harita üstte, KK1).
import { Foto } from '@/components/ui/Foto';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InceEkle, Kamera } from '@/components/ortak/YerSatiri';
import type { IcerikCanli } from '@/features/icerik/fotolar';
import { geziGunOzeti } from '@/features/icerik/gezi';
import { useGeziRotasi } from '@/features/icerik/geziRota';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import type { GeziDetay, GeziDuragi, GeziGunu } from '@/lib/tipler';
import { anaV5, renk, yazi, yeniGunRengi } from '@/theme';

type Props = {
  gezi: GeziDetay;
  canli: Map<string, IcerikCanli> | undefined;
  listede: (d: GeziDuragi) => boolean;
  mesgulId: string | null;
  onDurakEkle: (d: GeziDuragi) => void;
  /** #388 KK5 (kanvas 23c): bağlantı yokken + / ✓ pasif (%40). */
  eklePasif?: boolean;
  /** Satıra dokunuldu (mekan rehberi). */
  onDurak?: (d: GeziDuragi) => void;
};

export function GeziPlani({ gezi, ...p }: Props) {
  return (
    <View style={s.kap}>
      {gezi.gezi_gunleri.map((g, i) => (
        <GunBolumu key={g.id} gun={g} ilk={i === 0} {...p} />
      ))}
    </View>
  );
}

function GunBolumu({ gun, ilk, canli, listede, mesgulId, onDurakEkle, eklePasif, onDurak }: Omit<Props, 'gezi'> & { gun: GeziGunu; ilk: boolean }) {
  const { rotalar } = useGeziRotasi(gun);
  const ozet = useMemo(() => geziGunOzeti(gun.gezi_duraklari, rotalar), [gun, rotalar]);
  const rengi = yeniGunRengi(gun.sira);
  return (
    <View>
      {ilk ? null : (
        <View style={s.gunBaslik}>
          <Text style={s.gunAd} accessibilityRole="header" numberOfLines={1}>
            {`${t('gezi.gunKisa', { n: gun.sira })}${gun.baslik ? ` · ${gun.baslik}` : ''}`}
          </Text>
          <Text style={s.gunSayi}>{t('gezi.v6.gunDurak', { n: gun.gezi_duraklari.length })}</Text>
        </View>
      )}
      {gun.gezi_duraklari.map((d, i) => {
        const c = canli?.get(d.id);
        const dk = i > 0 ? ozet.bacakDk[i - 1] : undefined;
        return (
          <View key={d.id}>
            {i > 0 ? (
              // #205 Parça 1: bir ucu konumsuz bacak — süre yok, "Yol süresi bilinmiyor".
              <View style={s.bacak} testID={dk === null ? 'gezi-bacak-bilinmiyor' : undefined}>
                <View style={s.bacakCizgi} />
                <Text style={s.bacakMetin}>{dk === null ? t('gezi.yolBilinmiyor') : t(ozet.bacakMod[i - 1] === 'DRIVE' ? 'gezi.arac' : 'gezi.yuruyus', { n: dk ?? 0 })}</Text>
              </View>
            ) : null}
            {/* #172 KK7: satır DB'den çizilir; panel için yalnız Google kimliği gerekir. */}
            <Pressable accessibilityRole="button" disabled={!onDurak || !c?.place_id} onPress={() => onDurak?.(d)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
              <View style={[s.numara, { backgroundColor: rengi }]}>
                <Text style={s.numaraMetin}>{i + 1}</Text>
              </View>
              <View style={s.foto}>{c?.foto_uri ? <Foto source={{ uri: c.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : <Kamera />}</View>
              <View style={s.metin}>
                <Text style={s.ad} numberOfLines={1}>
                  {d.ad}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {`${kategoriEtiketi(d.kategori)} · ${sureMetni(d.sure_dk)}`}
                </Text>
              </View>
              <View style={s.dugmeAlani}>
                <InceEkle listede={listede(d)} mesgul={mesgulId === d.id} pasif={eklePasif} ipucu={eklePasif ? t('ekleme.baglantiYokIpucu') : undefined} onPress={() => onDurakEkle(d)} />
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { paddingTop: 8 },
  gunBaslik: { paddingTop: 16, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  gunAd: { flexShrink: 1, fontFamily: yazi.ekstra, fontSize: 17, color: renk.metin },
  gunSayi: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  numara: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.zemin },
  foto: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: anaV5.fotoYok },
  metin: { flex: 1, minWidth: 0, gap: 1 },
  ad: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  // 32 px ince "+" 44 px dokunma alanında; görünür kenar satırın sağına hizalı.
  dugmeAlani: { width: 44, height: 44, marginRight: -6, alignItems: 'center', justifyContent: 'center' },
  // Kanvas: 24 px numaranın ortasından 2 × 16 px çizgi (11 px içeride), yazı 22 px sağında.
  bacak: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingLeft: 11 },
  bacakCizgi: { width: 2, height: 16, backgroundColor: anaV5.cizgi },
  bacakMetin: { fontFamily: yazi.normal, fontSize: 12, color: anaV5.ikincil },
});
