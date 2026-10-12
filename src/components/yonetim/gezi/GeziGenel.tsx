import { StyleSheet, Text, View } from 'react-native';

import { durumAlanlari, gecerliSlug, geziDurumu, slugUret, yerelTarihGirdisi, yerelTarihtenIso, type GeziAlanlari, type GeziDurumu } from '@/features/yonetim/gezi';
import type { YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { okumaSuresiDk } from '@/lib/markdown';
import { yazi } from '@/theme';

import { Alan, AlanSatiri, MetinKutusu, SecimKutusu, TarihKutusu } from '../Form';
import { yRenk } from '../tema';

type Props = {
  taslak: GeziAlanlari;
  sehirler: YonetimSehri[];
  degistir: (alanlar: Partial<GeziAlanlari> | ((t: GeziAlanlari) => Partial<GeziAlanlari>), hemen?: boolean) => void;
  slugHatasi: boolean;
};

const DURUMLAR: GeziDurumu[] = ['taslak', 'yayinda', 'planli'];

/**
 * KK2 (kanvas ekran 2 alanları): başlık · şehir · durum / özet · yazar · okuma (otomatik).
 * Slug ve planlı yayın tarihi kanvasta yok (tasarım bekliyor): aynı alan kutusuyla üçüncü satırda.
 */
export function GeziGenel({ taslak, sehirler, degistir, slugHatasi }: Props) {
  const durum = geziDurumu(taslak);
  // Slug elle değiştirilmediyse başlıkla birlikte yenilenir (yeni gezinin geçici slug'ı dahil).
  const slugOtomatik = taslak.slug === slugUret(taslak.baslik) || /^yeni-gezi-[a-z0-9]{4}$/.test(taslak.slug);
  const baslikDegisti = (baslik: string) => degistir(slugOtomatik ? { baslik, slug: slugUret(baslik) } : { baslik });
  const slugGecersiz = !gecerliSlug(taslak.slug);

  return (
    <View style={s.kap}>
      <AlanSatiri>
        <Alan etiket={ty('gezi.alan.baslik')}>
          <MetinKutusu value={taslak.baslik} onChangeText={baslikDegisti} maxLength={120} accessibilityLabel={ty('gezi.alan.baslik')} />
        </Alan>
        <Alan etiket={ty('gezi.alan.sehir')} genislik={160}>
          <SecimKutusu etiket={ty('gezi.alan.sehir')} deger={taslak.sehir_id} onDegis={(sehir_id) => degistir({ sehir_id }, true)} secenekler={sehirler.map((sh) => ({ deger: sh.id, etiket: sh.ad }))} />
        </Alan>
        <Alan etiket={ty('gezi.alan.durum')} genislik={120}>
          <SecimKutusu
            etiket={ty('gezi.alan.durum')}
            deger={durum}
            onDegis={(d) => degistir(durumAlanlari(d, taslak.yayin_at), true)}
            secenekler={DURUMLAR.map((d) => ({ deger: d, etiket: ty(`gezi.durum.${d}`) }))}
          />
        </Alan>
      </AlanSatiri>
      <AlanSatiri>
        <Alan etiket={ty('gezi.alan.ozet')}>
          <MetinKutusu value={taslak.ozet ?? ''} onChangeText={(ozet) => degistir({ ozet: ozet || null })} maxLength={140} accessibilityLabel={ty('gezi.alan.ozet')} />
        </Alan>
        <Alan etiket={ty('gezi.alan.yazar')} genislik={120}>
          <MetinKutusu value={taslak.yazar_ad ?? ''} onChangeText={(yazar_ad) => degistir({ yazar_ad: yazar_ad || null })} maxLength={60} accessibilityLabel={ty('gezi.alan.yazar')} />
        </Alan>
        <Alan etiket={ty('gezi.alan.okuma')} genislik={80}>
          <View style={s.saltOkunur}>
            <Text style={s.saltMetin}>{ty('gezi.okumaDk', { n: okumaSuresiDk(taslak.yazi_md) })}</Text>
          </View>
        </Alan>
      </AlanSatiri>
      <AlanSatiri>
        <Alan etiket={ty('gezi.alan.slug')}>
          <MetinKutusu
            value={taslak.slug}
            onChangeText={(slug) => degistir({ slug: slug.toLowerCase() })}
            autoCapitalize="none"
            maxLength={80}
            hatali={slugGecersiz || slugHatasi}
            accessibilityLabel={ty('gezi.alan.slug')}
          />
          {slugGecersiz || slugHatasi ? <Text style={s.hata}>{ty(slugHatasi ? 'gezi.slugHata' : 'gezi.slugGecersiz')}</Text> : null}
        </Alan>
        {durum === 'planli' ? (
          <Alan etiket={ty('gezi.alan.planli')} genislik={220}>
            <TarihKutusu
              etiket={ty('gezi.alan.planli')}
              deger={yerelTarihGirdisi(taslak.yayin_at)}
              onDegis={(g) => {
                const iso = yerelTarihtenIso(g);
                if (iso) degistir({ yayin_at: iso }, true);
              }}
            />
          </Alan>
        ) : null}
      </AlanSatiri>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  saltOkunur: { minHeight: 36, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: yRenk.cerceve, justifyContent: 'center' },
  saltMetin: { fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: '#ff5a1f' },
});
