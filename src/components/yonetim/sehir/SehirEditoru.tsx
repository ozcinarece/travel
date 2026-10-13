import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fotoHataAnahtari, useFotoIslemleri, useIcerikFotolari } from '@/features/yonetim/fotolar';
import { saatMetni } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { useOtomatikKayit } from '@/features/yonetim/otomatikKayit';
import { rolAta } from '@/features/yonetim/sehir';
import { sehirAlanlari, sehirAnahtari, SEHIR_LISTESI, SEHIR_SECICI, type YonetimSehirDetayi } from '@/features/yonetim/sehirSorgulari';
import { yazi } from '@/theme';

import { DurumRozeti } from '../Form';
import { Hap } from '../Hap';
import { sutun, YonetimSayfasi } from '../Kabuk';
import { KayitDurumu } from '../Ortak';
import { yRenk } from '../tema';
import { NeredeGorunur } from './NeredeGorunur';
import { SehirFotolari } from './SehirFotolari';
import { SehirGenel } from './SehirGenel';
import { SehirRehberSekmesi } from './SehirRehberSekmesi';

type Sekme = 'genel' | 'rehber' | 'fotolar';
const SEKMELER: Sekme[] = ['genel', 'rehber', 'fotolar'];

type Props = { sehir: YonetimSehirDetayi; sehirler: YonetimSehirDetayi[]; liste: ReactNode; sekme: Sekme; onSekme: (s: Sekme) => void };

/**
 * #111 şehir editörü. Genel ve Fotoğraflar (kanvas Sehir19): solda şehir listesi, ortada sekmeler, sağda "NEREDE
 * GÖRÜNÜR"; başlıkta ŞEHİRLER · ad + durum rozeti, kayıt durumu, Önizle, Kaydet, sekmeler (#155). Rehber: #156
 * (SehirRehberSekmesi — taslak + Yayınla). Şehir kimliğiyle anahtarlanır.
 */
export function SehirEditoru({ sehir, sehirler, liste, sekme, onSekme }: Props) {
  const { taslak, degistir, durum, simdiKaydet } = useOtomatikKayit({
    tablo: 'sehirler',
    id: sehir.id,
    ilk: sehirAlanlari(sehir),
    yenilenecek: [SEHIR_LISTESI, SEHIR_SECICI, sehirAnahtari(sehir.id)],
  });
  const fotolar = useIcerikFotolari('sehir', sehir.id);
  const fotoIs = useFotoIslemleri('sehir', sehir.id);
  const [hata, setHata] = useState<string | null>(null);
  const islemHatasi = () => setHata(ty('gezi.islemHata'));
  const merkez = { lat: taslak.lat, lng: taslak.lng, yaricapM: 20000 };
  const gezi = sehir.geziler?.[0]?.count ?? 0;
  const komsuSehir = sehirler.find((s) => s.id !== sehir.id);

  const fotoYukle = async (dosya: File) => {
    try {
      return await fotoIs.yukle(dosya, (fotolar.data?.length ?? 0) + 1);
    } catch (e) {
      throw new Error(ty(`sehir.fotoHata.${fotoHataAnahtari(e)}`));
    }
  };
  const onizle = async () => {
    const pencere = window.open('about:blank', '_blank');
    await simdiKaydet();
    if (pencere) pencere.location.href = `/yonetim/sehirler/onizle?id=${sehir.id}`;
  };
  const kayitMetni = durum.kaydediliyor
    ? ty('gezi.kaydediliyor')
    : durum.hata === 'kayit'
      ? ty('gezi.kayitHata')
      : durum.kaydedildi
        ? ty('rehber.kaydedildi', { saat: saatMetni(durum.kaydedildi) })
        : null;
  const sekmeler = { secili: sekme, onSec: (a: string) => onSekme(a as Sekme), sekmeler: SEKMELER.map((a) => ({ anahtar: a, etiket: ty(`sehir.sekme.${a}`) })) };

  if (sekme === 'rehber') {
    return (
      <SehirRehberSekmesi
        sehirId={sehir.id}
        sehir={taslak}
        sekmeler={sekmeler}
        merkez={merkez}
        fotoYukle={fotoYukle}
        onOzet={(ozet) => degistir({ ozet })}
        onFotolar={() => onSekme('fotolar')}
      />
    );
  }
  return (
    <YonetimSayfasi
      sutunlu
      baslik={taslak.ad}
      kapak={taslak.kapak_url}
      rozet={<DurumRozeti durum={taslak.yayin ? 'yayinda' : 'taslak'} etiket={ty(taslak.yayin ? 'sehir.durum.yayinda' : 'sehir.durum.taslak')} />}
      durum={kayitMetni ? <KayitDurumu metin={kayitMetni} hata={!!durum.hata} /> : null}
      sekmeler={sekmeler}
      eylemler={
        <>
          <Hap baslik={ty('gezi.onizle')} onPress={onizle} ikon={<GozIkonu />} />
          <Hap tur="birincil" baslik={ty('sehir.kaydet')} onPress={() => void simdiKaydet()} />
        </>
      }>
      {liste}
      <ScrollView style={sutun.orta} contentContainerStyle={sutun.ortaIc}>
        <View style={sutun.kagit}>
        {hata ? (
          <Pressable accessibilityRole="button" onPress={() => setHata(null)}>
            <Text style={s.hata}>{hata}</Text>
          </Pressable>
        ) : null}
        {sekme === 'genel' ? <SehirGenel taslak={taslak} degistir={degistir} tekilHatasi={durum.hata === 'tekil'} /> : null}
        {sekme === 'fotolar' ? (
          <SehirFotolari
            sehirId={sehir.id}
            slug={taslak.slug}
            taslak={taslak}
            fotolar={fotolar.data ?? []}
            onYukle={async (dosyalar) => {
              for (const d of dosyalar) {
                try {
                  await fotoYukle(d);
                } catch (e) {
                  setHata((e as Error).message);
                }
              }
            }}
            onRol={(yol, rol) => degistir((t) => rolAta(rol, yol, t), true)}
            onAltMetin={(yol, a) => fotoIs.altyazi(yol, a).catch(islemHatasi)}
            onKaynak={(yol, k) => fotoIs.kaynak(yol, k).catch(islemHatasi)}
            onSil={(yol) => {
              degistir((t) => rolAta(null, yol, t), true);
              fotoIs.sil(yol).catch(islemHatasi);
            }}
          />
        ) : null}
        </View>
      </ScrollView>
      <NeredeGorunur id={sehir.id} taslak={taslak} gezi={gezi} komsu={komsuSehir ? { id: komsuSehir.id, ad: komsuSehir.ad, kapak_url: komsuSehir.kapak_url, gezi: komsuSehir.geziler?.[0]?.count ?? 0 } : undefined} />
    </YonetimSayfasi>
  );
}

function GozIkonu() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.ana} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

const s = StyleSheet.create({
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.hata },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  onizleme: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: yRenk.zemin, borderLeftWidth: 1, borderLeftColor: yRenk.ayrac },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
});
