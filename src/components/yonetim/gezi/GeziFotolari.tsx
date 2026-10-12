import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tasi } from '@/features/yonetim/gezi';
import type { IcerikFotosu } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { icerikFotoUrl } from '@/lib/markdown';
import { yazi } from '@/theme';

import { MetinKutusu } from '../Form';
import { Hap } from '../Hap';
import { dosyaSec, useDosyaBirakma, useSuruklenen } from '../surukle';
import { yRenk } from '../tema';

type Props = {
  fotolar: IcerikFotosu[];
  kapakUrl: string | null;
  onYukle: (dosyalar: File[]) => Promise<void>;
  onKapak: (url: string) => void;
  onYaziyaEkle: (foto: IcerikFotosu) => void;
  onAltyazi: (yol: string, altyazi: string) => void;
  onSirala: (yollar: string[]) => void;
  onSil: (yol: string) => void;
};

/**
 * KK5: Storage `icerik/geziler/<id>/` — yükle (düğme ya da sürükle-bırak), kapak seç, altyazı, sırala, sil; herkese açık
 * okuma. Kanvasta bu sekme çizilmedi (tasarım bekliyor): kesikli kutu, durak satırı stili ve haplarla kuruldu.
 */
export function GeziFotolari({ fotolar, kapakUrl, onYukle, onKapak, onYaziyaEkle, onAltyazi, onSirala, onSil }: Props) {
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

  return (
    <View style={s.kap}>
      <View ref={alan} style={s.birak}>
        <Text style={s.birakMetin}>{ty('gezi.fotoBirak')}</Text>
        <Hap tur="birincil" baslik={ty('gezi.fotoYukle')} yukleniyor={mesgul} onPress={() => dosyaSec(true, yukle)} />
      </View>
      {fotolar.length === 0 ? <Text style={s.bos}>{ty('gezi.fotoYok')}</Text> : null}
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
          onSil={() => onSil(f.yol)}
        />
      ))}
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
  const kaydet = () => altyazi.trim() !== (foto.altyazi ?? '') && onAltyazi(altyazi);
  return (
    <View ref={ref} style={s.satir}>
      <Image source={{ uri: icerikFotoUrl(foto.yol) }} style={s.kucuk} contentFit="cover" />
      <View style={s.altyazi}>
        <MetinKutusu value={altyazi} onChangeText={setAltyazi} onBlur={kaydet} onSubmitEditing={kaydet} maxLength={200} placeholder={ty('gezi.alan.altyazi')} accessibilityLabel={ty('gezi.alan.altyazi')} />
      </View>
      <Hap tur={kapak ? 'birincil' : 'ikincil'} baslik={ty(kapak ? 'gezi.kapak' : 'gezi.kapakYap')} onPress={onKapak} />
      <Hap baslik={ty('gezi.yaziyaEkle')} onPress={onYaziyaEkle} />
      <Pressable accessibilityRole="button" accessibilityLabel={ty('gezi.fotoSil')} onPress={onSil} hitSlop={8}>
        <Text style={s.sil}>×</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 6 },
  birak: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: yRenk.cerceve,
  },
  birakMetin: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac },
  kucuk: { width: 44, height: 44, borderRadius: 10, backgroundColor: yRenk.yuzey },
  altyazi: { flex: 1, minWidth: 0 },
  sil: { fontFamily: yazi.normal, fontSize: 12.5, color: yRenk.ikincil },
});
