import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fotoHataAnahtari, useFotoIslemleri, useIcerikFotolari } from '@/features/yonetim/fotolar';
import { blokEkle, gorselSatiri, saatMetni } from '@/features/yonetim/gezi';
import type { YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { useOtomatikKayit } from '@/features/yonetim/otomatikKayit';
import { mekanBaglari } from '@/features/yonetim/sehir';
import { mekanlariYaz, type MekanAdi } from '@/features/yonetim/sehirSorgulari';
import { gecerliPlaceId } from '@/features/yonetim/yer';
import { yerAlanlari, yerAnahtari, YER_LISTESI, type YonetimYeri } from '@/features/yonetim/yerSorgulari';
import { useHafifYerler } from '@/features/yerler/api';
import { yazi } from '@/theme';

import { Sekmeler } from '../Form';
import { Hap } from '../Hap';
import { IcerikFotolari } from '../IcerikFotolari';
import { YonetimSayfasi } from '../Kabuk';
import { OlcekliTelefon } from '../gezi/GeziOnizleme';
import { yRenk } from '../tema';
import { RehberEditoru } from './RehberEditoru';
import { YerGenel } from './YerGenel';
import { YerOnizleme } from './YerOnizleme';

type Sekme = 'genel' | 'rehber' | 'fotolar';
const SEKMELER: Sekme[] = ['genel', 'rehber', 'fotolar'];

/**
 * #108 kanvas ekran 4: üst çubuk ("Yer · ad", durum, Önizle, Yayınla), solda liste (sayfa verir), ortada sekmeler
 * (Genel · Rehber · Fotoğraflar), sağda mekan paneli Rehber önizlemesi. Yer kimliğiyle anahtarlanır.
 */
export function YerEditoru({ yer, sehirler, liste }: { yer: YonetimYeri; sehirler: YonetimSehri[]; liste: ReactNode }) {
  // #111: rehberdeki mekanlar kayıtta `icerik_mekanlari`na (sahip: yer); yeni seçilenler taslak yer olarak açılır.
  const bilinen = useRef<Record<string, MekanAdi>>({});
  const { taslak, degistir, durum, simdiKaydet } = useOtomatikKayit({
    tablo: 'yerler',
    id: yer.id,
    ilk: yerAlanlari(yer),
    yenilenecek: [YER_LISTESI, yerAnahtari(yer.id)],
    onKaydedildi: async (t, fark) => {
      if (fark.rehber_md !== undefined) await mekanlariYaz('yer', yer.id, mekanBaglari(t.rehber_md), bilinen.current);
    },
  });
  const fotolar = useIcerikFotolari('yer', yer.id);
  const fotoIs = useFotoIslemleri('yer', yer.id);
  const [sekme, setSekme] = useState<Sekme>('rehber');
  const [hata, setHata] = useState<string | null>(null);
  const sehir = sehirler.find((sh) => sh.id === taslak.sehir_id);
  const merkez = { lat: taslak.lat, lng: taslak.lng, yaricapM: sehir ? 20000 : 5000 };
  const canli = useHafifYerler(gecerliPlaceId(taslak.place_id) ? [taslak.place_id!] : []);
  const islemHatasi = () => setHata(ty('gezi.islemHata'));

  const fotoYukle = async (dosya: File) => {
    try {
      return await fotoIs.yukle(dosya, (fotolar.data?.length ?? 0) + 1);
    } catch (e) {
      throw new Error(ty(`gezi.fotoHata.${fotoHataAnahtari(e)}`));
    }
  };
  const onizle = async () => {
    const pencere = window.open('about:blank', '_blank');
    await simdiKaydet();
    if (pencere) pencere.location.href = `/yonetim/yerler/${yer.id}/onizle`;
  };
  const kayitMetni = durum.kaydediliyor
    ? ty('gezi.kaydediliyor')
    : durum.hata === 'kayit'
      ? ty('gezi.kayitHata')
      : durum.kaydedildi
        ? ty(taslak.yayin ? 'yer.kaydedildi' : 'yer.taslakKaydedildi', { saat: saatMetni(durum.kaydedildi) })
        : null;

  return (
    <YonetimSayfasi
      sutunlu
      baslik={ty('yer.baslik', { ad: taslak.ad })}
      eylemler={
        <>
          <Text style={s.durum}>{ty(taslak.yayin ? 'yer.durum.yayinda' : 'yer.durum.taslak')}</Text>
          <Hap baslik={ty('gezi.onizle')} onPress={onizle} ikon={<GozIkonu />} />
          <Hap tur="birincil" baslik={ty('gezi.yayinla')} onPress={() => degistir({ yayin: true }, true)} />
        </>
      }>
      {liste}
      <ScrollView style={s.orta} contentContainerStyle={s.ortaIc}>
        <Sekmeler secili={sekme} onSec={setSekme} sekmeler={SEKMELER.map((a) => ({ anahtar: a, etiket: ty(`yer.sekme.${a}`) }))} />
        {hata ? (
          <Pressable accessibilityRole="button" onPress={() => setHata(null)}>
            <Text style={s.hata}>{hata}</Text>
          </Pressable>
        ) : null}
        {sekme === 'genel' ? <YerGenel taslak={taslak} sehirler={sehirler} degistir={degistir} tekilHatasi={durum.hata === 'tekil'} /> : null}
        {sekme === 'rehber' ? (
          <RehberEditoru
            md={taslak.rehber_md}
            onDegis={(rehber_md) => degistir({ rehber_md: rehber_md || null })}
            merkez={merkez}
            fotoYukle={fotoYukle}
            onHata={setHata}
            kayitMetni={kayitMetni}
            onMekanSecildi={(y) => {
              bilinen.current[y.place_id] = { ad: y.ad, kategori: y.primary_type, lat: y.lat, lng: y.lng };
            }}
          />
        ) : null}
        {sekme === 'fotolar' ? (
          <IcerikFotolari
            fotolar={fotolar.data ?? []}
            kapakUrl={taslak.kapak_url}
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
            onYaziyaEkle={(f) => {
              degistir((t) => {
                const md = t.rehber_md ?? '';
                return { rehber_md: blokEkle(md, { start: md.length, end: md.length }, gorselSatiri(f.altyazi ?? '', f.yol)).metin.trim() };
              });
              setSekme('rehber');
            }}
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
        <Text style={s.etiket}>{ty('yer.onizleme')}</Text>
        <OlcekliTelefon olcek={0.62}>
          <YerOnizleme yer={taslak} canli={gecerliPlaceId(taslak.place_id) ? canli.data?.[taslak.place_id!] : undefined} />
        </OlcekliTelefon>
        <Text style={s.not}>{ty('yer.not')}</Text>
      </View>
    </YonetimSayfasi>
  );
}

function GozIkonu() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

const s = StyleSheet.create({
  durum: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: '#ff5a1f' },
  orta: { flex: 1, minWidth: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac },
  ortaIc: { flexGrow: 1, paddingVertical: 16, paddingHorizontal: 20, gap: 12 },
  onizleme: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: yRenk.yuzey },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  not: { fontFamily: yazi.yari, fontSize: 11, lineHeight: 16, color: yRenk.ikincil },
});
