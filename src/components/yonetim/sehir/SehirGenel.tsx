import { StyleSheet, Text, View } from 'react-native';

import { slugUret } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { yayinEngeli, type SehirAlanlari } from '@/features/yonetim/sehir';
import { yazi } from '@/theme';

import { Alan, AlanSatiri, MetinKutusu, SecimKutusu } from '../Form';
import { yRenk } from '../tema';

type Props = {
  taslak: SehirAlanlari;
  degistir: (alanlar: Partial<SehirAlanlari>, hemen?: boolean) => void;
  tekilHatasi: boolean;
};

const sayi = (m: string) => {
  const n = Number(m.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * KK1 Genel (kanvas Sehir19 notu: ad, slug, konum, özet — rehber 2 cümle, yayın). Sekme çizilmedi (tasarım bekliyor):
 * yer editörünün alan kutusuyla. Karo kapağı yoksa yayın uyarısı.
 */
export function SehirGenel({ taslak, degistir, tekilHatasi }: Props) {
  const engel = yayinEngeli(taslak);
  return (
    <View style={s.kap}>
      <AlanSatiri>
        <Alan etiket={ty('sehir.alan.ad')}>
          <MetinKutusu value={taslak.ad} onChangeText={(ad) => degistir({ ad })} maxLength={80} accessibilityLabel={ty('sehir.alan.ad')} />
        </Alan>
        <Alan etiket={ty('sehir.alan.slug')} genislik={200}>
          <MetinKutusu
            value={taslak.slug}
            onChangeText={(m) => degistir({ slug: m.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            onBlur={() => !taslak.slug && degistir({ slug: slugUret(taslak.ad) }, true)}
            autoCapitalize="none"
            hatali={tekilHatasi || !/^[a-z0-9-]{2,60}$/.test(taslak.slug)}
            accessibilityLabel={ty('sehir.alan.slug')}
          />
          {tekilHatasi ? <Text style={s.hata}>{ty('sehir.slugTekil')}</Text> : null}
        </Alan>
        <Alan etiket={ty('sehir.alan.durum')} genislik={120}>
          <SecimKutusu
            etiket={ty('sehir.alan.durum')}
            deger={taslak.yayin ? 'yayinda' : 'taslak'}
            onDegis={(d) => degistir({ yayin: d === 'yayinda' }, true)}
            secenekler={[
              { deger: 'taslak', etiket: ty('sehir.durum.taslak') },
              { deger: 'yayinda', etiket: ty('sehir.durum.yayinda') },
            ]}
          />
        </Alan>
      </AlanSatiri>
      {engel && taslak.yayin ? <Text style={s.hata}>{ty('sehir.kapakUyari')}</Text> : null}
      <AlanSatiri>
        <Alan etiket={ty('sehir.alan.lat')} genislik={160}>
          <MetinKutusu defaultValue={String(taslak.lat)} onChangeText={(m) => sayi(m) !== null && degistir({ lat: sayi(m)! })} inputMode="decimal" accessibilityLabel={ty('sehir.alan.lat')} />
        </Alan>
        <Alan etiket={ty('sehir.alan.lng')} genislik={160}>
          <MetinKutusu defaultValue={String(taslak.lng)} onChangeText={(m) => sayi(m) !== null && degistir({ lng: sayi(m)! })} inputMode="decimal" accessibilityLabel={ty('sehir.alan.lng')} />
        </Alan>
      </AlanSatiri>
      <Alan etiket={ty('sehir.alan.ozet')}>
        <MetinKutusu
          multiline
          value={taslak.ozet ?? ''}
          onChangeText={(ozet) => degistir({ ozet: ozet || null })}
          maxLength={400}
          style={s.ozet}
          accessibilityLabel={ty('sehir.alan.ozet')}
        />
        <Text style={s.bilgi}>{ty('sehir.ozetSayac', { n: (taslak.ozet ?? '').length })}</Text>
      </Alan>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  ozet: { minHeight: 90, textAlignVertical: 'top' },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: '#ff5a1f' },
  bilgi: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
});
