import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { blokEkle, gorselSatiri, saatMetni, yayinlaAlanlari } from '@/features/yonetim/gezi';
import { fotoHataAnahtari, useFotoIslemleri, useIcerikFotolari } from '@/features/yonetim/fotolar';
import { alanlariAl, GEZI_LISTESI, geziAnahtari, useGeziIslemleri, type YonetimGezi, type YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { useOtomatikKayit } from '@/features/yonetim/otomatikKayit';
import { ty } from '@/features/yonetim/metin';
import type { GeziDetay } from '@/lib/tipler';
import { yazi } from '@/theme';

import { Sekmeler } from '../Form';
import { Hap } from '../Hap';
import { IcerikFotolari } from '../IcerikFotolari';
import { YonetimSayfasi } from '../Kabuk';
import { yRenk } from '../tema';
import { GeziGenel } from './GeziGenel';
import { GeziOnizleme, OlcekliTelefon } from './GeziOnizleme';
import { GeziPlanEditoru } from './GeziPlanEditoru';
import { GeziYazi } from './GeziYazi';

type Sekme = 'genel' | 'yazi' | 'plan' | 'fotolar';
const SEKMELER: Sekme[] = ['genel', 'yazi', 'plan', 'fotolar'];

/** Önizlemeye giden gezi: kaydı beklenen taslak alanları + sunucudaki günler/duraklar. */
export function onizlemeGezisi(gezi: YonetimGezi, taslak: Partial<GeziDetay>): GeziDetay {
  return { ...gezi, ...taslak, gezi_gunleri: gezi.gezi_gunleri } as GeziDetay;
}

/**
 * #107 kanvas ekran 2: üst çubuk ("Gezi · başlık", Kaydedildi · saat, Önizle, Yayınla), solda liste (sayfa verir),
 * ortada sekmeler, sağda 300 px telefon önizlemesi. Gezi kimliğiyle anahtarlanır (otomatik kayıt her gezide yeni).
 */
export function GeziEditoru({ gezi, sehirler, liste }: { gezi: YonetimGezi; sehirler: YonetimSehri[]; liste: React.ReactNode }) {
  const { taslak, degistir, durum, simdiKaydet } = useOtomatikKayit({ tablo: 'geziler', id: gezi.id, ilk: alanlariAl(gezi), yenilenecek: [GEZI_LISTESI, geziAnahtari(gezi.id)] });
  const islemler = useGeziIslemleri(gezi.id);
  const fotolar = useIcerikFotolari('gezi', gezi.id);
  const fotoIs = useFotoIslemleri('gezi', gezi.id);
  const [sekme, setSekme] = useState<Sekme>('yazi');
  const [sayfa, setSayfa] = useState<0 | 1>(0);
  const [hata, setHata] = useState<string | null>(null);
  const sehir = sehirler.find((sh) => sh.id === taslak.sehir_id);
  const merkez = sehir ? { lat: sehir.lat, lng: sehir.lng, yaricapM: 20000 } : undefined;
  const onizleme = useMemo(() => onizlemeGezisi(gezi, taslak), [gezi, taslak]);
  const islemHatasi = () => setHata(ty('gezi.islemHata'));

  const onizle = async () => {
    const pencere = window.open('about:blank', '_blank');
    await simdiKaydet();
    if (pencere) pencere.location.href = `/yonetim/geziler/${gezi.id}/onizle`;
  };
  const fotoYukle = async (dosya: File) => {
    try {
      return await fotoIs.yukle(dosya, (fotolar.data?.length ?? 0) + 1);
    } catch (e) {
      throw new Error(ty(`gezi.fotoHata.${fotoHataAnahtari(e)}`));
    }
  };
  const yaziyaEkle = (yol: string, alt: string) => {
    degistir((t) => {
      const md = t.yazi_md ?? '';
      return { yazi_md: blokEkle(md, { start: md.length, end: md.length }, gorselSatiri(alt, yol)).metin };
    });
    setSekme('yazi');
  };

  const kayitMetni = durum.kaydediliyor
    ? ty('gezi.kaydediliyor')
    : durum.hata
      ? ty(durum.hata === 'tekil' ? 'gezi.slugHata' : 'gezi.kayitHata')
      : durum.kaydedildi
        ? ty('gezi.kaydedildi', { saat: saatMetni(durum.kaydedildi) })
        : null;

  return (
    <YonetimSayfasi
      sutunlu
      baslik={ty('gezi.baslik', { baslik: taslak.baslik })}
      eylemler={
        <>
          {kayitMetni ? <Text style={[s.kayit, durum.hata && s.hata]}>{kayitMetni}</Text> : null}
          <Hap baslik={ty('gezi.onizle')} onPress={onizle} ikon={<GozIkonu />} />
          <Hap tur="birincil" baslik={ty('gezi.yayinla')} onPress={() => degistir((t) => yayinlaAlanlari(t), true)} />
        </>
      }>
      {liste}
      <ScrollView style={s.orta} contentContainerStyle={s.ortaIc}>
        <Sekmeler secili={sekme} onSec={setSekme} sekmeler={SEKMELER.map((a) => ({ anahtar: a, etiket: ty(`gezi.sekme.${a}`) }))} />
        {hata ? (
          <Pressable accessibilityRole="button" onPress={() => setHata(null)}>
            <Text style={s.hata}>{hata}</Text>
          </Pressable>
        ) : null}
        {sekme === 'genel' ? <GeziGenel taslak={taslak} sehirler={sehirler} degistir={degistir} slugHatasi={durum.hata === 'tekil'} /> : null}
        {sekme === 'yazi' ? (
          <GeziYazi
            metin={taslak.yazi_md ?? ''}
            onDegis={(yeni) => degistir((t) => ({ yazi_md: typeof yeni === 'function' ? yeni(t.yazi_md ?? '') : yeni }))}
            merkez={merkez}
            fotoYukle={fotoYukle}
            onHata={setHata}
          />
        ) : null}
        {sekme === 'plan' ? <GeziPlanEditoru gunler={gezi.gezi_gunleri} merkez={merkez} islemler={islemler} onHata={islemHatasi} /> : null}
        {sekme === 'fotolar' ? (
          <IcerikFotolari
            fotolar={fotolar.data ?? []}
            kapakUrl={taslak.kapak_url}
            yazidaMi={(yol) => (taslak.yazi_md ?? '').includes(`foto:${yol}`)}
            onYukle={async (dosyalar) => {
              for (const d of dosyalar) {
                try {
                  await fotoYukle(d);
                } catch (e) {
                  setHata((e as Error).message);
                }
              }
            }}
            onKapak={(kapak_url) => degistir({ kapak_url }, true)}
            onYaziyaEkle={(f) => yaziyaEkle(f.yol, f.altyazi ?? '')}
            onAltyazi={(yol, a) => fotoIs.altyazi(yol, a).catch(islemHatasi)}
            onSirala={(yollar) => fotoIs.sirala(yollar).catch(islemHatasi)}
            onSil={(yol) => {
              if (taslak.kapak_url?.endsWith(yol)) degistir({ kapak_url: null }, true);
              fotoIs.sil(yol).catch(islemHatasi);
            }}
          />
        ) : null}
      </ScrollView>
      <View style={s.onizleme}>
        <View style={s.onizlemeUst}>
          <Text style={s.etiket}>{ty(sayfa === 0 ? 'gezi.onizleme1' : 'gezi.onizleme2')}</Text>
          {/* Kanvas: "‹ 1 / 2 ›" — oklar sayfayı değiştirir. */}
          <Text style={s.etiket}>
            <Text accessibilityRole="button" accessibilityLabel={ty('gezi.oncekiSayfa')} accessibilityState={{ disabled: sayfa === 0 }} onPress={() => setSayfa(0)} style={sayfa === 0 && s.pasif}>
              ‹
            </Text>
            {` ${sayfa + 1} / 2 `}
            <Text accessibilityRole="button" accessibilityLabel={ty('gezi.sonrakiSayfa')} accessibilityState={{ disabled: sayfa === 1 }} onPress={() => setSayfa(1)} style={sayfa === 1 && s.pasif}>
              ›
            </Text>
          </Text>
        </View>
        <OlcekliTelefon olcek={0.62}>
          <GeziOnizleme gezi={onizleme} sehirAdi={sehir?.ad ?? ''} sayfa={sayfa} />
        </OlcekliTelefon>
      </View>
    </YonetimSayfasi>
  );
}

/** Kanvas "Önizle" göz ikonu (14 px, 2,4 çizgi). */
function GozIkonu() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

const s = StyleSheet.create({
  pasif: { opacity: 0.4 },
  kayit: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: '#ff5a1f' },
  orta: { flex: 1, minWidth: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac },
  ortaIc: { flexGrow: 1, paddingVertical: 16, paddingHorizontal: 20, gap: 14 },
  onizleme: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: yRenk.yuzey },
  onizlemeUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
});
