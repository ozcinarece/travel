import { StyleSheet, Text, View } from 'react-native';

import { oran, type Ozet } from '@/features/yonetim/genelBakis';
import { ty } from '@/features/yonetim/metin';
import { binlik } from '@/features/yonetim/yer';
import { yazi } from '@/theme';

import { yGolge, yRenk } from '../tema';

/** Kanvas ızgarası: 1fr 64 52 44 44, 8 aralık. */
const SUTUN = [64, 52, 44, 44] as const;

/**
 * KK3 (kanvas "En çok alınan geziler · 30 gün"): 440 px kart; başlık satırı 10,5 px 800 gri büyük harf; satırlar 9 px
 * dikey, üstte #ebebeb çizgi, 12,5 px — gezi adı 700 + altında "Şehir · N gün" 11 px gri; görüntü gri 600, alındı /
 * kalp 800, oran 800 yeşil.
 */
export function EnCokTablosu({ gun, satirlar }: { gun: number; satirlar: Ozet['en_cok_alinan'] }) {
  return (
    <View style={s.kart}>
      <Text style={s.baslik}>{ty('genel.tablo.baslik', { gun })}</Text>
      <View style={s.basliklar}>
        <Text style={[s.ustMetin, s.esnek]}>{ty('genel.tablo.gezi')}</Text>
        {(['goruntu', 'alindi', 'kalp', 'oran'] as const).map((k, i) => (
          <Text key={k} style={[s.ustMetin, { width: SUTUN[i] }]}>
            {ty(`genel.tablo.${k}`)}
          </Text>
        ))}
      </View>
      {satirlar.length === 0 ? <Text style={s.bos}>{ty('genel.tablo.bos')}</Text> : null}
      {satirlar.map((g) => (
        <View key={g.id} style={s.satir}>
          <View style={s.esnek}>
            <Text style={s.ad} numberOfLines={1}>
              {g.baslik}
            </Text>
            <Text style={s.alt} numberOfLines={1}>
              {ty('genel.tablo.alt', { sehir: g.sehir, gun: g.gun_sayisi })}
            </Text>
          </View>
          <Text style={[s.goruntu, { width: SUTUN[0] }]}>{binlik(g.goruntu)}</Text>
          <Text style={[s.kalin, { width: SUTUN[1] }]}>{binlik(g.alindi)}</Text>
          <Text style={[s.kalin, { width: SUTUN[2] }]}>{binlik(g.kalp)}</Text>
          <Text style={[s.kalin, s.oran, { width: SUTUN[3] }]}>{oran(g.alindi, g.goruntu)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  kart: { width: 440, padding: 20, borderRadius: 22, backgroundColor: yRenk.zemin, boxShadow: yGolge },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin, paddingBottom: 8 },
  basliklar: { flexDirection: 'row', gap: 8, paddingBottom: 6 },
  ustMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, color: yRenk.ikincil },
  esnek: { flex: 1, minWidth: 0 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: yRenk.ayrac },
  ad: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  alt: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  goruntu: { fontFamily: yazi.yari, fontSize: 12.5, color: yRenk.ikincil },
  kalin: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
  oran: { color: yRenk.basari },
  bos: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil, paddingVertical: 9, borderTopWidth: 1, borderTopColor: yRenk.ayrac },
});
