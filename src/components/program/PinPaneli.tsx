import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Ikon } from '@/components/ui/Ikon';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import type { Gun, Mekan } from '@/lib/tipler';
import { gunRengi, renk, yazi } from '@/theme';

type Props = {
  mekan: Mekan;
  yer: HafifYer | undefined;
  /** Google editoryal özeti (pahalı SKU; yalnız panel açıkken). */
  ozet: string | null | undefined;
  ekleyenAd: string;
  dakika: number;
  gunler: Gun[];
  /** Mekanın atanmış olduğu gün (varsa). */
  mevcutGunId: string | null;
  mesgul: boolean;
  onGunSec: (gun: Gun) => void;
  onSure: (fark: number) => void;
  onDetay: () => void;
  onYolTarifi: () => void;
  onDiger: () => void;
  onKapat: () => void;
};

/**
 * #45 §6 pin paneli: ad, kategori · süre · açık/kapalı; ★ puan · yorum · ekleyen; küçük foto.
 * Tek satır: "Gün ① ② ③" (seçili dolu, gün renginde) + sağda süre −/+. "Bilmen gerekenler": 2 satır özet ("Devamı")
 * (Google özeti; ipucu hapları #47 ile kalktı). Aksiyonlar: Detay · Yol tarifi · ··· (Listeden çıkar).
 */
export function PinPaneli(p: Props) {
  const { mekan, yer } = p;
  const [acik, setAcik] = useState(false);
  const puan = puanMetni(yer?.puan);
  const yorum = yorumKisa(yer?.puan_sayisi);
  // #47 E16: "Bilmen gerekenler" yalnız Google özeti; özet yoksa kutu gizli.
  const bilgiVar = !!p.ozet;
  return (
    <View style={s.kap}>
      <View style={s.ust}>
        {yer?.foto_uri ? <Image source={{ uri: yer.foto_uri }} style={s.foto} contentFit="cover" /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.ad} numberOfLines={2}>
            {yer?.ad ?? '…'}
          </Text>
          <Text style={s.alt} numberOfLines={1}>
            {kategoriEtiketi(mekan.primary_type)} · {sureMetni(p.dakika)}
            {yer?.acik === true ? ` · ${t('mekan.acik')}` : yer?.acik === false ? ` · ${t('mekan.kapali')}` : ''}
          </Text>
          <View style={s.satir}>
            {puan ? (
              <Text style={s.alt}>
                <Text style={{ color: renk.vurgu }}>★</Text> {puan}
                {yorum ? ` · ${yorum}` : ''}
              </Text>
            ) : null}
            {p.ekleyenAd ? (
              <View style={s.ekleyen}>
                <Avatar ad={p.ekleyenAd} boyut={16} arkaPlan={renk.vurgu} />
                <Text style={s.alt}>{p.ekleyenAd}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.vazgec')} onPress={p.onKapat} hitSlop={8} style={s.kapat}>
          <Text style={s.kapatMetin}>×</Text>
        </Pressable>
      </View>

      <View style={s.gunSatir}>
        <Text style={s.etiket}>{t('program.pin.gun')}</Text>
        <View style={s.gunler}>
          {p.gunler.map((g) => {
            const secili = g.id === p.mevcutGunId;
            const rengi = gunRengi(g.index);
            return (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                accessibilityLabel={t('program.gunSec', { n: g.index })}
                accessibilityState={{ selected: secili, disabled: p.mesgul }}
                disabled={p.mesgul}
                hitSlop={4}
                onPress={() => p.onGunSec(g)}
                style={[s.gunDaire, { borderColor: rengi }, secili && { backgroundColor: rengi }]}>
                <Text style={[s.gunMetin, { color: secili ? renk.zemin : rengi }]}>{g.index}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.sureKontrol}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('program.azalt')} onPress={() => p.onSure(-15)} style={s.sureDugme}>
            <Text style={s.sureIsaret}>−</Text>
          </Pressable>
          <Text style={s.sureMetin}>{sureMetni(p.dakika)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('program.artir')} onPress={() => p.onSure(15)} style={s.sureDugme}>
            <Text style={s.sureIsaret}>+</Text>
          </Pressable>
        </View>
      </View>

      {bilgiVar ? (
        <View style={s.bilgi}>
          <Text style={s.bilgiBaslik}>{t('program.pin.bilmen')}</Text>
          {p.ozet ? (
            <Pressable accessibilityRole="button" onPress={() => setAcik((a) => !a)}>
              <Text style={s.ozet} numberOfLines={acik ? undefined : 2}>
                {p.ozet}
              </Text>
              <Text style={s.devami}>{acik ? t('program.pin.daha_az') : t('program.pin.devami')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={s.dugmeler}>
        <Pressable accessibilityRole="button" onPress={p.onDetay} style={s.dugme}>
          <Text style={s.dugmeMetin}>{t('program.pin.detay')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={p.onYolTarifi} style={s.dugme}>
          <Text style={s.dugmeMetin}>{t('program.pin.yolTarifi')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('program.pin.diger')} onPress={p.onDiger} style={[s.dugme, s.dugmeKucuk]}>
          <Ikon ad="daha" boyut={20} renk={renk.metin} kalinlik={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 12 },
  ust: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  foto: { width: 64, height: 64, borderRadius: 12, backgroundColor: renk.yuzey },
  ad: { fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.3, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ekleyen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kapat: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  kapatMetin: { fontFamily: yazi.kalin, fontSize: 20, color: renk.ikincil },
  gunSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  etiket: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  gunler: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  gunDaire: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: renk.zemin },
  gunMetin: { fontFamily: yazi.ekstra, fontSize: 12 },
  sureKontrol: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: 999, backgroundColor: renk.yuzey, paddingHorizontal: 2 },
  sureDugme: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sureIsaret: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  sureMetin: { width: 46, textAlign: 'center', fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  bilgi: { padding: 12, borderRadius: 14, backgroundColor: renk.yuzey, gap: 8 },
  bilgiBaslik: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  ozet: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.metin },
  devami: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin, marginTop: 2 },
  dugmeler: { flexDirection: 'row', gap: 8 },
  dugme: { flex: 1, height: 40, borderRadius: 999, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  dugmeKucuk: { flex: 0, width: 52 },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
});
