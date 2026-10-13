import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AralikSecici } from '@/components/yonetim/genel/AralikSecici';
import { EnCokTablosu } from '@/components/yonetim/genel/EnCokTablosu';
import { HaftalikGrafik } from '@/components/yonetim/genel/HaftalikGrafik';
import { KpiKarti } from '@/components/yonetim/genel/KpiKarti';
import { Hap } from '@/components/yonetim/Hap';
import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { yGolge, yRenk } from '@/components/yonetim/tema';
import { csvDosyaAdi, csvMetni, kartlar, type Ozet } from '@/features/yonetim/genelBakis';
import { useGenelBakis, useSentryOzeti, useYorumKotasi } from '@/features/yonetim/genelBakisSorgulari';
import { ty } from '@/features/yonetim/metin';
import { binlik } from '@/features/yonetim/yer';
import { yazi } from '@/theme';

/** KK6 "Dışa aktar": tarayıcıda CSV indirir (Excel Türkçe karakterleri için BOM). */
function csvIndir(o: Ozet) {
  const blob = new Blob([`﻿${csvMetni(o, ty)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvDosyaAdi(o.aralik_gun);
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * #110 genel bakış (kanvas ekran 1): üst çubukta "Son 30 gün" ve "Dışa aktar"; beş KPI kartı; haftalık grafik ve en
 * çok alınan geziler yan yana; altta günün özeti. Veri `yonetim_ozet()` tek çağrı, 10 dk önbellek.
 */
export default function GenelBakisSayfasi() {
  const [gun, setGun] = useState(30);
  const ozet = useGenelBakis(gun);
  const sentry = useSentryOzeti();
  const kota = useYorumKotasi();
  const o = ozet.data;

  const sentryMetni = sentry.data
    ? sentry.data.bagli
      ? ty('genel.bugun.sentry', { n: binlik(sentry.data.hata) })
      : ty('genel.bugun.sentryYok')
    : sentry.isError
      ? ty('genel.bugun.sentryHata')
      : null;

  return (
    <YonetimSayfasi
      baslik={ty('menu.genel')}
      eylemler={
        <>
          <AralikSecici gun={gun} onDegis={setGun} />
          <Hap baslik={ty('genel.disaAktar')} onPress={() => o && csvIndir(o)} yukleniyor={!o && ozet.isLoading} />
        </>
      }>
      {/* Yükleme ve hata durumları kanvasta yok (tasarım bekliyor): gövde açıklama satırıyla. */}
      {!o ? (
        ozet.isError ? (
          <View style={s.hataSatiri}>
            <Aciklama>{ty('genel.hata')}</Aciklama>
            <Hap baslik={ty('genel.yeniden')} onPress={() => ozet.refetch()} />
          </View>
        ) : (
          <Aciklama>{ty('genel.yukleniyor')}</Aciklama>
        )
      ) : (
        <>
          <View style={s.satir}>
            {kartlar(o, ty).map((k) => (
              <KpiKarti key={k.anahtar} kart={k} />
            ))}
          </View>
          <View style={s.satir}>
            <HaftalikGrafik seri={o.haftalik} />
            <EnCokTablosu gun={o.aralik_gun} satirlar={o.en_cok_alinan} />
          </View>
          <View style={s.bugun}>
            <Text style={s.bugunMetin}>
              <Text style={s.bugunBaslik}>{`${ty('genel.bugun.baslik')} `}</Text>
              {ty('genel.bugun.ozet', { kullanici: binlik(o.bugun.kullanici), seyahat: binlik(o.bugun.seyahat), gezi: binlik(o.bugun.gezi_alindi) })}
            </Text>
            <Text style={s.bugunMetin}>
              {ty('genel.bugun.istek', { kesfet: binlik(o.bugun.kesfet), mekan: binlik(o.bugun.mekan_paneli), yorum: binlik(o.bugun.yorum) })}
              {kota.data?.sinir ? ` · ${ty('genel.bugun.yorumKotasi', { n: binlik(kota.data.kullanilan), sinir: binlik(kota.data.sinir) })}` : ''}
            </Text>
            {sentryMetni ? <Text style={s.bugunMetin}>{sentryMetni}</Text> : null}
          </View>
        </>
      )}
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  satir: { flexDirection: 'row', gap: 12 },
  hataSatiri: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Kanvas günün özeti: 14 × 18 iç boşluk, 14 yarıçap, 1 px #ebebeb, 12,5 px 600 gri, parçalar arası 24.
  bugun: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 6, padding: 20, borderRadius: 22, backgroundColor: yRenk.zemin, boxShadow: yGolge },
  bugunMetin: { fontFamily: yazi.yari, fontSize: 12.5, color: yRenk.ikincil },
  bugunBaslik: { fontFamily: yazi.kalin, color: yRenk.metin },
});
