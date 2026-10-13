import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { gecerliPlaceId, oneCikanSirasi, type YerAlanlari } from '@/features/yonetim/yer';
import { hafifYerler, useHafifYerler } from '@/features/yerler/api';
import { kategoriEtiketi } from '@/lib/kategori';
import { yorumKisa } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { Alan, AlanSatiri, MetinKutusu, SecimKutusu } from '../Form';
import { Hap } from '../Hap';
import { yRenk } from '../tema';

type Props = {
  taslak: YerAlanlari;
  sehirler: YonetimSehri[];
  degistir: (alanlar: Partial<YerAlanlari>, hemen?: boolean) => void;
  tekilHatasi: boolean;
};

/**
 * KK2: ad, place_id (+ canlı Google verisi: kategori, puan, yorum, konum — salt okunur, saklanmaz), şehir, öne çıkan
 * sırası, durum. Kanvasta yalnız alan listesi notu var (tasarım bekliyor): gezi editörünün alan kutusuyla.
 */
export function YerGenel({ taslak, sehirler, degistir, tekilHatasi }: Props) {
  const [sira, setSira] = useState(taslak.one_cikan_sira === null ? '' : String(taslak.one_cikan_sira));
  const [dogrulama, setDogrulama] = useState<'yok' | 'mesgul' | 'tamam' | 'bulunamadi'>('yok');
  const placeGecerli = gecerliPlaceId(taslak.place_id);
  // Canlı veri yalnız ekranda (24 sa istemci önbelleği); DB'ye puan / yorum yazılmaz (PRD §7).
  // #172: BO yer önizlemesi Google'ın canlı ★ puanını ve yorum sayısını gösterir (tek kimlik, önbellekten).
  const canli = useHafifYerler(placeGecerli ? [taslak.place_id!] : [], { puan: true });
  const g = placeGecerli ? canli.data?.[taslak.place_id!] : undefined;
  const siraSonuc = oneCikanSirasi(sira);

  const dogrula = async () => {
    if (!placeGecerli) return;
    setDogrulama('mesgul');
    try {
      // #172 KK3: yalnız kategori ve konum yazılır — Pro maske.
      const [yer] = await hafifYerler([taslak.place_id!], { puansiz: true });
      if (!yer) throw new Error('yok');
      degistir({ kategori: yer.primary_type, lat: yer.lat, lng: yer.lng }, true);
      setDogrulama('tamam');
    } catch {
      setDogrulama('bulunamadi');
    }
  };

  return (
    <View style={s.kap}>
      <AlanSatiri>
        <Alan etiket={ty('yer.alan.ad')}>
          <MetinKutusu value={taslak.ad} onChangeText={(ad) => degistir({ ad })} maxLength={120} accessibilityLabel={ty('yer.alan.ad')} />
        </Alan>
        <Alan etiket={ty('yer.alan.sehir')} genislik={160}>
          <SecimKutusu etiket={ty('yer.alan.sehir')} deger={taslak.sehir_id} onDegis={(sehir_id) => degistir({ sehir_id }, true)} secenekler={sehirler.map((sh) => ({ deger: sh.id, etiket: sh.ad }))} />
        </Alan>
        <Alan etiket={ty('yer.alan.durum')} genislik={120}>
          <SecimKutusu
            etiket={ty('yer.alan.durum')}
            deger={taslak.yayin ? 'yayinda' : 'taslak'}
            onDegis={(d) => degistir({ yayin: d === 'yayinda' }, true)}
            secenekler={[
              { deger: 'taslak', etiket: ty('yer.durum.taslak') },
              { deger: 'yayinda', etiket: ty('yer.durum.yayinda') },
            ]}
          />
        </Alan>
      </AlanSatiri>
      <AlanSatiri>
        <Alan etiket={ty('yer.alan.placeId')}>
          <MetinKutusu
            value={taslak.place_id ?? ''}
            onChangeText={(p) => {
              setDogrulama('yok');
              degistir({ place_id: p.trim() || null });
            }}
            autoCapitalize="none"
            hatali={!!taslak.place_id && !placeGecerli}
            accessibilityLabel={ty('yer.alan.placeId')}
          />
          {taslak.place_id && !placeGecerli ? <Text style={s.hata}>{ty('yer.placeGecersiz')}</Text> : null}
          {dogrulama === 'bulunamadi' ? <Text style={s.hata}>{ty('yer.placeBulunamadi')}</Text> : null}
          {dogrulama === 'tamam' ? <Text style={s.bilgi}>{ty('yer.dogrulandi')}</Text> : null}
        </Alan>
        <View style={s.dugme}>
          <Hap kucuk baslik={ty('yer.dogrula')} onPress={dogrula} yukleniyor={dogrulama === 'mesgul'} />
        </View>
        <Alan etiket={ty('yer.alan.oneCikan')} genislik={140}>
          <MetinKutusu
            value={sira}
            onChangeText={setSira}
            onBlur={() => siraSonuc !== 'gecersiz' && siraSonuc !== taslak.one_cikan_sira && degistir({ one_cikan_sira: siraSonuc }, true)}
            inputMode="numeric"
            hatali={siraSonuc === 'gecersiz' || tekilHatasi}
            accessibilityLabel={ty('yer.alan.oneCikan')}
          />
          {siraSonuc === 'gecersiz' || tekilHatasi ? <Text style={s.hata}>{ty(tekilHatasi ? 'yer.oneCikanTekil' : 'yer.oneCikanGecersiz')}</Text> : null}
        </Alan>
      </AlanSatiri>
      <Text style={s.bilgi}>{ty('yer.canli')}</Text>
      <AlanSatiri>
        <SaltOkunur etiket={ty('yer.alan.kategori')} deger={kategoriEtiketi(g?.primary_type ?? taslak.kategori)} />
        <SaltOkunur etiket={ty('yer.alan.puan')} deger={g?.puan != null ? `★ ${g.puan.toLocaleString('tr-TR')}` : '—'} genislik={100} />
        <SaltOkunur etiket={ty('yer.alan.yorum')} deger={yorumKisa(g?.puan_sayisi) ?? '—'} genislik={100} />
        <SaltOkunur etiket={ty('yer.alan.konum')} deger={`${(g?.lat ?? taslak.lat).toFixed(5)}, ${(g?.lng ?? taslak.lng).toFixed(5)}`} genislik={200} />
      </AlanSatiri>
    </View>
  );
}

function SaltOkunur({ etiket, deger, genislik }: { etiket: string; deger: string; genislik?: number }) {
  return (
    <Alan etiket={etiket} genislik={genislik}>
      <View style={s.salt}>
        <Text style={s.saltMetin} numberOfLines={1}>
          {deger}
        </Text>
      </View>
    </Alan>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  dugme: { justifyContent: 'flex-start', paddingTop: 17 },
  salt: { minHeight: 36, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: yRenk.yuzey, justifyContent: 'center' },
  saltMetin: { fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.hata },
  bilgi: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
});
