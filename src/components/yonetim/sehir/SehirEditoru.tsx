import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fotoHataAnahtari, useFotoIslemleri, useIcerikFotolari } from '@/features/yonetim/fotolar';
import { saatMetni } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { useOtomatikKayit } from '@/features/yonetim/otomatikKayit';
import { eksikBolum, rolAta, yayinEngeli, type RehberBolumu } from '@/features/yonetim/sehir';
import {
  sehirAlanlari,
  sehirAnahtari,
  SEHIR_LISTESI,
  SEHIR_SECICI,
  useRehberBolumleri,
  useRehberIslemleri,
  type YonetimSehirDetayi,
} from '@/features/yonetim/sehirSorgulari';
import { yazi } from '@/theme';

import { Sekmeler } from '../Form';
import { Hap } from '../Hap';
import { YonetimSayfasi } from '../Kabuk';
import { OlcekliTelefon } from '../gezi/GeziOnizleme';
import { yRenk } from '../tema';
import { NeredeGorunur } from './NeredeGorunur';
import { BolumEditoru, BolumListesi } from './RehberBolumleri';
import { RehberOnizleme } from './RehberOnizleme';
import { SehirFotolari } from './SehirFotolari';
import { SehirGenel } from './SehirGenel';

type Sekme = 'genel' | 'rehber' | 'fotolar';
const SEKMELER: Sekme[] = ['genel', 'rehber', 'fotolar'];

type Props = { sehir: YonetimSehirDetayi; sehirler: YonetimSehirDetayi[]; liste: ReactNode; sekme: Sekme; onSekme: (s: Sekme) => void };

/**
 * #111 şehir editörü. Genel ve Fotoğraflar (kanvas Sehir19): solda şehir listesi, ortada sekmeler, sağda "NEREDE
 * GÖRÜNÜR"; üst çubukta "Şehir · ad", durum, Önizle, Kaydet. Rehber bölümleri (kanvas RehberEditor22): solda bölümler,
 * ortada bölüm editörü, sağda uygulama rehber sekmesi önizlemesi; üst çubukta Önizle, Yayınla. Şehir kimliğiyle anahtarlanır.
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
  const bolumler = useRehberBolumleri(sehir.id);
  const rehberIs = useRehberIslemleri(sehir.id);
  const [seciliBolum, setSeciliBolum] = useState<string | undefined>(undefined);
  const [canliBolum, setCanliBolum] = useState<Partial<RehberBolumu> & { id?: string }>({});
  const [hata, setHata] = useState<string | null>(null);
  const islemHatasi = () => setHata(ty('gezi.islemHata'));
  const liste_ = bolumler.data ?? [];
  const bolum = liste_.find((b) => b.id === seciliBolum) ?? liste_[0];
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
  const yayinla = () => {
    if (yayinEngeli(taslak)) {
      setHata(ty('sehir.kapakUyari'));
      onSekme('fotolar');
      return;
    }
    degistir({ yayin: true }, true);
  };
  const onizle = async () => {
    const pencere = window.open('about:blank', '_blank');
    await simdiKaydet();
    if (pencere) pencere.location.href = `/yonetim/sehirler/onizle?id=${sehir.id}`;
  };
  const bolumEkle = async () => {
    const tur = eksikBolum(liste_);
    if (!tur) return;
    try {
      const { id } = await rehberIs.ekle(tur, ty(`rehber.varsayilan.${tur}`), liste_.length + 1);
      setSeciliBolum(id);
    } catch {
      islemHatasi();
    }
  };
  const kayitMetni = durum.kaydediliyor
    ? ty('gezi.kaydediliyor')
    : durum.hata === 'kayit'
      ? ty('gezi.kayitHata')
      : durum.kaydedildi
        ? ty('rehber.kaydedildi', { saat: saatMetni(durum.kaydedildi) })
        : null;
  // Önizleme düzenlenen bölümün taslağını görür.
  const onizlemeBolumleri = liste_.map((b) => (b.id === canliBolum.id ? { ...b, ...canliBolum } : b));

  const rehber = sekme === 'rehber';
  return (
    <YonetimSayfasi
      sutunlu
      baslik={rehber ? ty('sehir.baslikRehber', { ad: taslak.ad }) : ty('sehir.baslik', { ad: taslak.ad })}
      eylemler={
        <>
          {rehber ? null : <Text style={s.durum}>{kayitMetni ?? ty(taslak.yayin ? 'sehir.durum.yayinda' : 'sehir.durum.taslak')}</Text>}
          <Hap baslik={ty('gezi.onizle')} onPress={onizle} ikon={<GozIkonu />} />
          {rehber ? <Hap tur="birincil" baslik={ty('gezi.yayinla')} onPress={yayinla} /> : <Hap tur="birincil" baslik={ty('sehir.kaydet')} onPress={() => void simdiKaydet()} />}
        </>
      }>
      {rehber ? (
        <BolumListesi
          sehirAdi={taslak.ad}
          bolumler={liste_}
          seciliId={bolum?.id}
          onSec={setSeciliBolum}
          onEkle={bolumEkle}
          onSirala={(yeni) => rehberIs.sirala(yeni).catch(islemHatasi)}
        />
      ) : (
        liste
      )}
      <ScrollView style={s.orta} contentContainerStyle={s.ortaIc}>
        <Sekmeler secili={sekme} onSec={onSekme} sekmeler={SEKMELER.map((a) => ({ anahtar: a, etiket: ty(`sehir.sekme.${a}`) }))} />
        {hata ? (
          <Pressable accessibilityRole="button" onPress={() => setHata(null)}>
            <Text style={s.hata}>{hata}</Text>
          </Pressable>
        ) : null}
        {sekme === 'genel' ? <SehirGenel taslak={taslak} degistir={degistir} tekilHatasi={durum.hata === 'tekil'} /> : null}
        {sekme === 'rehber' ? (
          bolum ? (
            <BolumEditoru key={bolum.id} bolum={bolum} merkez={merkez} fotoYukle={fotoYukle} onHata={setHata} onTaslak={(t) => setCanliBolum({ id: bolum.id, ...t })} />
          ) : (
            <Text style={s.bos}>{ty(bolumler.isPending ? 'genel.yukleniyor' : 'rehber.bos')}</Text>
          )
        ) : null}
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
      </ScrollView>
      {rehber ? (
        <View style={s.onizleme}>
          <Text style={s.etiket}>{ty('rehber.onizlemeEtiket')}</Text>
          <OlcekliTelefon olcek={0.62}>
            <RehberOnizleme sehirAdi={taslak.ad} bolumler={onizlemeBolumleri} seciliId={bolum?.id} />
          </OlcekliTelefon>
        </View>
      ) : (
        <NeredeGorunur id={sehir.id} taslak={taslak} gezi={gezi} komsu={komsuSehir ? { id: komsuSehir.id, ad: komsuSehir.ad, kapak_url: komsuSehir.kapak_url, gezi: komsuSehir.geziler?.[0]?.count ?? 0 } : undefined} />
      )}
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
  bos: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  orta: { flex: 1, minWidth: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac },
  ortaIc: { flexGrow: 1, paddingVertical: 16, paddingHorizontal: 20, gap: 14 },
  onizleme: { width: 300, flexShrink: 0, paddingVertical: 14, paddingHorizontal: 16, gap: 8, backgroundColor: yRenk.yuzey },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
});
