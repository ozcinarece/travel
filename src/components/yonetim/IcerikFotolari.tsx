import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fotoDosyaAdi, tasi } from '@/features/yonetim/gezi';
import type { IcerikFotosu } from '@/features/yonetim/fotolar';
import { ty } from '@/features/yonetim/metin';
import { icerikFotoUrl } from '@/lib/markdown';
import { yazi } from '@/theme';

import { Hap } from './Hap';
import { dosyaSec, useDosyaBirakma, useSuruklenen } from './surukle';
import { yRenk } from './tema';

type Props = {
  fotolar: IcerikFotosu[];
  kapakUrl: string | null;
  /** Yazıda kullanılan foto silinmek istenirse uyarılır. */
  yazidaMi?: (yol: string) => boolean;
  onYukle: (dosyalar: File[]) => Promise<void>;
  onKapak: (url: string) => void;
  onYaziyaEkle: (foto: IcerikFotosu) => void;
  onAltyazi: (yol: string, altyazi: string) => void;
  onSirala: (yollar: string[]) => void;
  onSil: (yol: string) => void;
};

const YUKLE = 'M12 16V4M6 10l6-6 6 6M4 20h16';
const TUTAMAC = 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01';

/**
 * #107 / #108 KK5 (kanvas BekleyenTasarim21 ekran 6): kesikli yükleme alanı (sürükle ya da seç); satır: tutamaç (sürükle =
 * sıra), 88 × 60 küçük resim (kapaksa "Kapak" rozeti ve siyah çerçeve), "dosya adı · ölçü", altyazı alanı, "Kapak ✓" /
 * "Kapak yap", "Yazıya ekle", ×; altta not. Storage `icerik/<geziler|yerler>/<id>/`, tablo `icerik_fotolari`.
 */
export function IcerikFotolari({ fotolar, kapakUrl, yazidaMi, onYukle, onKapak, onYaziyaEkle, onAltyazi, onSirala, onSil }: Props) {
  const alan = useRef<View>(null);
  const [mesgul, setMesgul] = useState(false);
  const yukle = async (dosyalar: File[]) => {
    if (!dosyalar.length) return;
    setMesgul(true);
    try {
      await onYukle(dosyalar);
    } finally {
      setMesgul(false);
    }
  };
  useDosyaBirakma(alan, yukle);
  const tasindi = (kaynak: number, hedef: number) => onSirala(tasi(fotolar, kaynak, hedef).map((f) => f.yol));
  const sil = (yol: string) => {
    if (yazidaMi?.(yol) && !window.confirm(ty('gezi.fotoYazidaSil'))) return;
    onSil(yol);
  };

  return (
    <View style={s.kap}>
      <Pressable ref={alan} accessibilityRole="button" accessibilityLabel={ty('gezi.fotoYukle')} disabled={mesgul} onPress={() => dosyaSec(true, yukle)} style={s.birak}>
        {mesgul ? (
          <ActivityIndicator size="small" color={yRenk.ikincil} />
        ) : (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={yRenk.ikincil} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d={YUKLE} />
          </Svg>
        )}
        <Text style={s.birakMetin}>{ty('gezi.fotoBirak')}</Text>
      </Pressable>
      {fotolar.length === 0 ? <Text style={s.bos}>{ty('gezi.fotoYok')}</Text> : null}
      <View style={s.liste}>
        {fotolar.map((f, i) => (
          <FotoSatiri
            key={f.yol}
            foto={f}
            indeks={i}
            kapak={icerikFotoUrl(f.yol) === kapakUrl}
            onBirak={tasindi}
            onKapak={() => onKapak(icerikFotoUrl(f.yol))}
            onYaziyaEkle={() => onYaziyaEkle(f)}
            onAltyazi={(a) => onAltyazi(f.yol, a)}
            onSil={() => sil(f.yol)}
          />
        ))}
      </View>
      {fotolar.length ? (
        <Text style={s.not}>
          {ty('gezi.fotoNotOnce')}
          <Text style={s.kod}>{ty('gezi.fotoNotKod')}</Text>
          {ty('gezi.fotoNotSonra')}
        </Text>
      ) : null}
    </View>
  );
}

function FotoSatiri({
  foto,
  indeks,
  kapak,
  onBirak,
  onKapak,
  onYaziyaEkle,
  onAltyazi,
  onSil,
}: {
  foto: IcerikFotosu;
  indeks: number;
  kapak: boolean;
  onBirak: (k: number, h: number) => void;
  onKapak: () => void;
  onYaziyaEkle: () => void;
  onAltyazi: (a: string) => void;
  onSil: () => void;
}) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, `foto-${foto.sahip_id}`, indeks, onBirak);
  const [altyazi, setAltyazi] = useState(foto.altyazi ?? '');
  // Ölçü DB'de yoksa görselin kendisinden (yüklenince).
  const [olcu, setOlcu] = useState<string | null>(null);
  const kaydet = () => altyazi.trim() !== (foto.altyazi ?? '') && onAltyazi(altyazi);
  const ad = fotoDosyaAdi(foto.yol);
  return (
    <View ref={ref} style={[s.satir, kapak && s.satirKapak]}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.yerTutucu} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d={TUTAMAC} />
      </Svg>
      <View style={s.kucuk}>
        <Image
          source={{ uri: icerikFotoUrl(foto.yol) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onLoad={(e) => e.source?.width && setOlcu(`${e.source.width}×${e.source.height}`)}
          accessibilityLabel={foto.altyazi ?? ad}
        />
        {kapak ? (
          <View style={s.rozet}>
            <Text style={s.rozetMetin}>{ty('gezi.kapak')}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.orta}>
        <Text style={s.ad} numberOfLines={1}>
          {olcu ? `${ad} · ${olcu}` : ad}
        </Text>
        <TextInput
          value={altyazi}
          onChangeText={setAltyazi}
          onBlur={kaydet}
          onSubmitEditing={kaydet}
          maxLength={200}
          placeholder={ty('gezi.altyaziEkle')}
          placeholderTextColor={yRenk.ikincil}
          accessibilityLabel={ty('gezi.alan.altyazi')}
          style={s.altyazi}
        />
      </View>
      <View style={s.eylemler}>
        <Hap kucuk tur={kapak ? 'birincil' : 'ikincil'} baslik={ty(kapak ? 'gezi.kapakTamam' : 'gezi.kapakYap')} onPress={onKapak} />
        <Hap kucuk baslik={ty('gezi.yaziyaEkle')} onPress={onYaziyaEkle} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={ty('gezi.fotoSil')} onPress={onSil} hitSlop={8}>
        <Text style={s.sil}>×</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  birak: { height: 64, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  birakMetin: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  liste: { gap: 8 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: yRenk.ayrac },
  satirKapak: { borderColor: yRenk.metin },
  kucuk: { width: 88, height: 60, borderRadius: 8, overflow: 'hidden', backgroundColor: yRenk.yuzey },
  rozet: { position: 'absolute', left: 6, top: 6, height: 20, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(14,20,48,0.75)', justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 9.5, color: yRenk.zemin },
  orta: { flex: 1, minWidth: 0, gap: 4 },
  ad: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.metin },
  altyazi: { height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: yRenk.cerceve, fontFamily: yazi.yari, fontSize: 12, color: yRenk.metin },
  eylemler: { gap: 4 },
  sil: { fontFamily: yazi.normal, fontSize: 14, color: yRenk.ikincil, paddingHorizontal: 4 },
  not: { fontFamily: yazi.normal, fontSize: 11.5, lineHeight: 16.7, color: yRenk.ikincil },
  kod: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 },
});
