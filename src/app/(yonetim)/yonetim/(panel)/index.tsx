import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AltMetin, EnCokAlinanlar, GoogleKarti, GostergeKarti, HaftaGrafigi, IcerikSagligi, Rozet } from '@/components/yonetim/genel/GenelKartlar';
import { Hap } from '@/components/yonetim/Hap';
import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { Segment } from '@/components/yonetim/Ortak';
import { yRenk } from '@/components/yonetim/tema';
import { degisimMetni, DONEMLER, PLAN_HEDEF_SN, selam, sureMetni, tarihEtiketi, yuzde, type Donem } from '@/features/yonetim/genelBakis';
import { useGenelBakis } from '@/features/yonetim/genelBakisSorgulari';
import { ty } from '@/features/yonetim/metin';
import { binlik } from '@/features/yonetim/yer';
import { useOturum } from '@/lib/oturum';

/**
 * #157 genel bakış (kanvas BO-0): başlıkta "GENEL BAKIŞ · 13 EKİM SALI" + "Günaydın Ece", dönem (Bugün · 7 gün · 30 gün);
 * dört gösterge (ilk saatlik plan, davet linki paylaşan, kurulan plan, alınan hazır gezi), bu hafta grafiği + Google API
 * bugün, en çok alınan geziler + içerik sağlığı. Olay henüz yoksa göstergede "veri bekleniyor" (sıfır değil).
 */
export default function GenelBakisSayfasi() {
  const [donem, setDonem] = useState<Donem>(7);
  const genel = useGenelBakis(donem);
  const { session } = useOturum();
  const ad = ((session?.user.user_metadata?.full_name as string | undefined) ?? '').trim().split(/\s+/)[0];
  const sel = selam();
  const o = genel.data;

  return (
    <YonetimSayfasi
      ust={ty('genel.ust', { tarih: tarihEtiketi() })}
      baslik={ad ? ty(`genel.selam.${sel}`, { ad }) : ty(`genel.selamAdsiz.${sel}`)}
      eylemler={
        <Segment
          etiket={ty('genel.donem.etiket')}
          secili={String(donem)}
          secenekler={DONEMLER.map((d) => ({ deger: String(d), etiket: ty(`genel.donem.${d}`) }))}
          onSec={(d) => setDonem(Number(d) as Donem)}
        />
      }>
      {!o ? (
        genel.isError ? (
          <View style={s.satir}>
            <Aciklama>{ty('genel.hata')}</Aciklama>
            <Hap kucuk baslik={ty('genel.yeniden')} onPress={() => genel.refetch()} />
          </View>
        ) : (
          <Aciklama>{ty('genel.yukleniyor')}</Aciklama>
        )
      ) : (
        <>
          <View style={s.sira}>
            <GostergeKarti
              baslik={ty('genel.ilkPlan.baslik')}
              bekleniyor={!o.ilk_plan.olay_var}
              deger={o.ilk_plan.medyan_sn !== null ? sureMetni(o.ilk_plan.medyan_sn) : ty('genel.yok')}
              alt={
                o.ilk_plan.olay_var ? (
                  <>
                    <AltMetin once={ty('genel.ilkPlan.alt')} />
                    {o.ilk_plan.medyan_sn !== null ? (
                      o.ilk_plan.medyan_sn < PLAN_HEDEF_SN ? <Rozet tur="basari" etiket={ty('genel.ilkPlan.hedefte')} /> : <Rozet tur="bekliyor" etiket={ty('genel.ilkPlan.hedefUstu')} />
                    ) : null}
                  </>
                ) : (
                  <AltMetin once={ty('genel.ilkPlan.bekleniyorAlt')} />
                )
              }
            />
            <GostergeKarti
              baslik={ty('genel.davet.baslik')}
              bekleniyor={!o.davet.olay_var}
              deger={yuzde(o.davet.paylasilan, o.davet.kurulan) ?? ty('genel.yok')}
              alt={
                o.davet.olay_var ? (
                  <AltMetin
                    once={`${ty('genel.davet.alt')}${yuzde(o.davet.katilan, o.davet.paylasilan) ? ' · ' : ''}`}
                    vurgu={yuzde(o.davet.katilan, o.davet.paylasilan) ? ty('genel.davet.katilim', { oran: yuzde(o.davet.katilan, o.davet.paylasilan)! }) : null}
                  />
                ) : (
                  <AltMetin once={ty('genel.davet.bekleniyorAlt')} />
                )
              }
            />
            <GostergeKarti
              baslik={ty('genel.plan.baslik')}
              bekleniyor={!o.plan.olay_var}
              deger={binlik(o.plan.sayi)}
              alt={
                !o.plan.olay_var ? (
                  <AltMetin once={ty('genel.ilkPlan.bekleniyorAlt')} />
                ) : degisimMetni(o.plan.sayi, o.plan.onceki) ? (
                  <AltMetin
                    vurgu={degisimMetni(o.plan.sayi, o.plan.onceki)}
                    vurguRengi={o.plan.sayi < o.plan.onceki ? yRenk.hata : undefined}
                    sonra={` ${ty(`genel.plan.degisim.${donem}`)}`}
                  />
                ) : (
                  <AltMetin once={ty('genel.plan.oncekiYok')} />
                )
              }
            />
            <GostergeKarti
              baslik={ty('genel.gezi.baslik')}
              bekleniyor={!o.gezi.olay_var}
              deger={binlik(o.gezi.sayi)}
              alt={<AltMetin once={o.gezi.en_cok ? ty('genel.gezi.enCok', { baslik: o.gezi.en_cok }) : ty('genel.gezi.yok')} />}
            />
          </View>
          <View style={s.sira}>
            <HaftaGrafigi hafta={o.hafta} bekleniyor={!o.hafta_olay_var} />
            <GoogleKarti google={o.google} />
          </View>
          <View style={s.sira}>
            <EnCokAlinanlar geziler={o.en_cok_alinan} />
            <IcerikSagligi sehirler={o.icerik} />
          </View>
        </>
      )}
    </YonetimSayfasi>
  );
}

const s = StyleSheet.create({
  sira: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
