import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { blokEkle, gorselSatiri, saatMetni, yayinlaAlanlari } from '@/features/yonetim/gezi';
import { useGeziIslemleri, useIcerikFotolari, useOtomatikKayit, type YonetimGezi, type YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import type { GeziDetay } from '@/lib/tipler';
import { yazi } from '@/theme';

import { Sekmeler } from '../Form';
import { Hap } from '../Hap';
import { YonetimSayfasi } from '../Kabuk';
import { yRenk } from '../tema';
import { GeziFotolari } from './GeziFotolari';
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
  const { taslak, degistir, durum, simdiKaydet } = useOtomatikKayit(gezi);
  const islemler = useGeziIslemleri(gezi.id);
  const fotolar = useIcerikFotolari('gezi', gezi.id);
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
      return await islemler.fotoYukle(dosya, (fotolar.data?.length ?? 0) + 1);
    } catch (e) {
      const kod = (e as Error).message;
      throw new Error(ty(kod === 'foto_tur' ? 'gezi.fotoHata.tur' : kod === 'foto_boyut' ? 'gezi.fotoHata.boyut' : 'gezi.fotoHata.yukleme'));
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
      ? ty(durum.hata === 'slug' ? 'gezi.slugHata' : 'gezi.kayitHata')
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
        {sekme === 'genel' ? <GeziGenel taslak={taslak} sehirler={sehirler} degistir={degistir} slugHatasi={durum.hata === 'slug'} /> : null}
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
          <GeziFotolari
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
            onYaziyaEkle={(f) => yaziyaEkle(f.yol, f.altyazi ?? '')}
            onAltyazi={(yol, a) => islemler.fotoAltyazi(yol, a).catch(islemHatasi)}
            onSirala={(yollar) => islemler.fotolariSirala(yollar).catch(islemHatasi)}
            onSil={(yol) => {
              if (taslak.kapak_url?.endsWith(yol)) degistir({ kapak_url: null }, true);
              islemler.fotoSil(yol).catch(islemHatasi);
            }}
          />
        ) : null}
      </ScrollView>
      <View style={s.onizleme}>
        <View style={s.onizlemeUst}>
          <Text style={s.etiket}>{ty('gezi.onizleme', { n: sayfa + 1 })}</Text>
          <Pressable accessibilityRole="button" onPress={() => setSayfa(sayfa === 0 ? 1 : 0)} hitSlop={6}>
            <Text style={s.etiket}>{ty('gezi.sayfa', { n: sayfa + 1 })}</Text>
          </Pressable>
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
  kayit: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: '#ff5a1f' },
  orta: { flex: 1, minWidth: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac },
  ortaIc: { flexGrow: 1, paddingVertical: 16, paddingHorizontal: 20, gap: 14 },
  onizleme: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: yRenk.yuzey },
  onizlemeUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
});
