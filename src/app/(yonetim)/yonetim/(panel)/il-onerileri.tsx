import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MekanArama, type MekanKimligi } from '@/components/yonetim/gezi/MekanArama';
import { MetinKutusu } from '@/components/yonetim/Form';
import { Hap } from '@/components/yonetim/Hap';
import { IlOneriTablosu } from '@/components/yonetim/il/IlOneriTablosu';
import { Aciklama, YonetimSayfasi } from '@/components/yonetim/Kabuk';
import { yIl, yRenk } from '@/components/yonetim/tema';
import { useYonetimSehirleri } from '@/features/yonetim/geziSorgulari';
import { ilceler, kategoriSayilari, kategoriTahmini, silindiSirasi, suz, tasi, yeniSira, zamanEtiketi, type IlKategori, type IlOneri } from '@/features/yonetim/ilOneri';
import {
  IL_LISTELERI,
  ilListesiYayinla,
  ilOneriEkle,
  ilOneriGuncelle,
  ilOneriSil,
  ilOneriSirala,
  ilOnerileriAnahtari,
  useIlListeleri,
  useIlOnerileri,
  type IlOneriAlanlari,
} from '@/features/yonetim/ilOneriSorgulari';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

// #401 KK4 (kanvas BO_IlOnerileri): /yonetim/il-onerileri?il=<slug>. İl seç, kategori ve ilçe süzgeci, sürükleyerek sırala,
// kategori / amaç / neden değiştir, gizle ya da göster, yeni yer ekle, listeyi yayınla.
export default function IlOnerileriSayfasi() {
  const { il } = useLocalSearchParams<{ il?: string }>();
  const qc = useQueryClient();
  const listeler = useIlListeleri();
  const slug = il ?? listeler.data?.[0]?.il_slug;
  const liste = listeler.data?.find((l) => l.il_slug === slug);
  const oneriler = useIlOnerileri(slug);
  const sehirler = useYonetimSehirleri();
  const [kategori, setKategori] = useState<IlKategori | null>(null);
  const [ilce, setIlce] = useState<string | null>(null);
  const [aramaAcik, setAramaAcik] = useState(false);
  // PRD §7: seçilen yerden yalnız kimlik ve tür tutulur; listede görünecek ad Ece'nin yazdığı metindir.
  const [secilen, setSecilen] = useState<MekanKimligi | null>(null);
  const [yeniAd, setYeniAd] = useState('');
  const [hata, setHata] = useState(false);
  const [yayinMesgul, setYayinMesgul] = useState(false);

  const tum = useMemo(() => oneriler.data ?? [], [oneriler.data]);
  const gorunen = useMemo(() => suz(tum, { kategori, ilce }), [tum, kategori, ilce]);
  const sayilar = kategoriSayilari(tum, ilce);
  const ilceListesi = ilceler(tum);
  const sehir = sehirler.data?.find((s) => s.slug === slug);
  const anahtar = ilOnerileriAnahtari(slug);

  /** Yazar, önbelleği tazeler; başarılıysa true. */
  const yaz = async (is: () => Promise<void>, iyimser?: (l: IlOneri[]) => IlOneri[]): Promise<boolean> => {
    setHata(false);
    if (iyimser) qc.setQueryData<IlOneri[]>(anahtar, (l) => (l ? iyimser(l) : l));
    let tamam = true;
    try {
      await is();
    } catch {
      tamam = false;
      setHata(true);
    }
    await Promise.all([qc.invalidateQueries({ queryKey: anahtar }), qc.invalidateQueries({ queryKey: IL_LISTELERI })]);
    return tamam;
  };

  const degis = (id: string, alanlar: IlOneriAlanlari) =>
    void yaz(
      () => ilOneriGuncelle(id, alanlar),
      (l) => l.map((o) => (o.id === id ? { ...o, ...alanlar } : o)),
    );
  const surukle = (kaynak: number, hedef: number) => {
    const sira = slug ? tasi(tum, gorunen, kaynak, hedef) : null;
    if (!sira || !slug) return;
    void yaz(
      () => ilOneriSirala(slug, sira),
      (l) => sira.map((id, i) => ({ ...l.find((o) => o.id === id)!, sira: i + 1 })),
    );
  };
  const sil = (id: string) => {
    if (!slug) return;
    const kalan = silindiSirasi(tum, id);
    void yaz(
      () => ilOneriSil(slug, id, kalan),
      (l) => kalan.map((k, i) => ({ ...l.find((o) => o.id === k)!, sira: i + 1 })),
    );
  };
  const sec = (yer: MekanKimligi) => {
    setSecilen({ place_id: yer.place_id, tip: yer.tip });
    setYeniAd('');
  };
  const ekle = async () => {
    const ad = yeniAd.trim();
    if (!slug || !secilen || !ad) return;
    const yer = secilen;
    // Alanlar yalnız yazma başarılıysa temizlenir; hata olursa yazılan ad kutuda kalır, altında "kaydedilemedi" çıkar.
    if (await yaz(() => ilOneriEkle(slug, { place_id: yer.place_id, tip: yer.tip, ad }, kategoriTahmini(yer.tip, kategori), yeniSira(tum)))) {
      setSecilen(null);
      setYeniAd('');
    }
  };
  const secimiBirak = () => {
    setSecilen(null);
    setYeniAd('');
  };
  const aramaAcKapa = () => {
    if (aramaAcik) {
      setSecilen(null);
      setYeniAd('');
    }
    setAramaAcik(!aramaAcik);
  };
  const yayinla = async () => {
    if (!slug) return;
    setYayinMesgul(true);
    await yaz(() => ilListesiYayinla(slug));
    setYayinMesgul(false);
  };

  const ozet = liste
    ? ty('ilOneri.ozet', {
        yer: tum.length,
        gorunur: tum.filter((o) => o.gorunur).length,
        durum: ty(`ilOneri.durum.${liste.yayinda ? 'yayinda' : 'taslak'}`),
        kim: ty(`ilOneri.kim.${liste.degistiren}`),
        zaman: zamanEtiketi(liste.degisti_at, new Date(), ty('ilOneri.bugun')),
      })
    : '';

  return (
    <YonetimSayfasi
      baslik={ty('menu.ilOnerileri')}
      rozet={
        listeler.data?.length ? (
          <View style={s.baslikYani}>
            <View style={s.secici}>
              <select
                aria-label={ty('ilOneri.il')}
                value={slug ?? ''}
                onChange={(e) => {
                  setKategori(null);
                  setIlce(null);
                  router.setParams({ il: e.target.value });
                }}
                style={ilDom}>
                {listeler.data.map((l) => (
                  <option key={l.il_slug} value={l.il_slug}>
                    {l.il}
                  </option>
                ))}
              </select>
              <Text style={s.ok} aria-hidden>
                ▾
              </Text>
            </View>
            <Text style={s.ozet} numberOfLines={1}>
              {ozet}
            </Text>
          </View>
        ) : undefined
      }
      eylemler={
        liste ? (
          <>
            <Dugme baslik={ty('ilOneri.yerEkle')} onPress={aramaAcKapa} />
            <Dugme vurgu baslik={ty('ilOneri.yayinla')} yukleniyor={yayinMesgul} onPress={() => void yayinla()} />
          </>
        ) : undefined
      }>
      {listeler.isError || oneriler.isError ? <Aciklama>{ty('ilOneri.yuklenemedi')}</Aciklama> : null}
      {listeler.data && !listeler.data.length ? <Aciklama>{ty('ilOneri.bos')}</Aciklama> : null}
      {liste ? (
        <View style={s.govde}>
          {aramaAcik ? (
            <View style={s.arama}>
              <MekanArama merkez={sehir ? { lat: sehir.lat, lng: sehir.lng } : undefined} onKimlik={sec} onKimlikBirak={secimiBirak} seciliKimlik={secilen?.place_id ?? null} etiket={ty('ilOneri.ara')} />
            </View>
          ) : null}
          {secilen ? (
            <View style={s.yeniSatir}>
              <MetinKutusu
                value={yeniAd}
                onChangeText={setYeniAd}
                maxLength={120}
                autoFocus
                placeholder={ty('ilOneri.adYerTutucu')}
                accessibilityLabel={ty('ilOneri.ad')}
                onSubmitEditing={() => void ekle()}
                style={s.yeniAd}
              />
              {yeniAd.trim() ? <Hap kucuk tur="birincil" baslik={ty('ilOneri.kaydet')} onPress={() => void ekle()} /> : null}
              <Hap
                kucuk
                baslik={ty('ilOneri.vazgec')}
                onPress={secimiBirak}
              />
            </View>
          ) : null}
          <View style={s.cipler}>
            <Cip etiket={ty('ilOneri.hepsi', { sayi: suz(tum, { kategori: null, ilce }).length })} secili={!kategori} onPress={() => setKategori(null)} />
            {sayilar.map(({ kategori: k, sayi }) => (
              <Cip key={k} etiket={ty('ilOneri.kategoriSayi', { kategori: ty(`ilOneri.kategori.${k}`), sayi })} secili={kategori === k} onPress={() => setKategori(k)} />
            ))}
            {ilceListesi.length ? (
              <View style={[s.secici, s.ilceSecici]}>
                <select aria-label={ty('ilOneri.ilceHepsi')} value={ilce ?? ''} onChange={(e) => setIlce(e.target.value || null)} style={ilceDom}>
                  <option value="">{ty('ilOneri.ilceHepsi')}</option>
                  {ilceListesi.map((i) => (
                    <option key={i} value={i}>
                      {ty('ilOneri.ilce', { ilce: i })}
                    </option>
                  ))}
                </select>
                <Text style={s.ok} aria-hidden>
                  ▾
                </Text>
              </View>
            ) : null}
          </View>
          {hata ? <Text style={s.hata}>{ty('ilOneri.kaydedilemedi')}</Text> : null}
          <IlOneriTablosu satirlar={gorunen} onDegis={degis} onTasi={surukle} onSil={sil} />
          <Text style={s.yardim}>{ty('ilOneri.yardim')}</Text>
        </View>
      ) : null}
    </YonetimSayfasi>
  );
}

/** Kanvas BO_IlOnerileri üst düğmeleri: 40 px, 20 köşe, 14 px 700. "+ Yer ekle" 1 px #E4E7EE çerçeve, 16 yan; "Yayınla" #FF7A1A, 18 yan. */
function Dugme({ baslik, onPress, vurgu, yukleniyor }: { baslik: string; onPress: () => void; vurgu?: boolean; yukleniyor?: boolean }) {
  const metin = vurgu ? yRenk.metin : yIl.metin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!yukleniyor, busy: !!yukleniyor }}
      disabled={yukleniyor}
      onPress={onPress}
      style={({ pressed }) => [s.dugme, vurgu ? s.dugmeVurgu : s.dugmeCerceve, (pressed || yukleniyor) && s.basili]}>
      {yukleniyor ? <ActivityIndicator size="small" color={metin} /> : null}
      <Text style={[s.dugmeMetin, { color: metin }]}>{baslik}</Text>
    </Pressable>
  );
}

/** Süzgeç çipi: 32 px, 16 köşe, 13 px 700; seçili #0E1430 + beyaz yazı, diğerleri #F6F7FA. */
function Cip({ etiket, secili, onPress }: { etiket: string; secili: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onPress} style={[s.cip, secili && s.cipSecili]}>
      <Text style={[s.cipMetin, secili && s.cipMetinSecili]}>{etiket}</Text>
    </Pressable>
  );
}

const ilDom = {
  height: 38,
  padding: '0 30px 0 14px',
  borderRadius: 10,
  border: `1px solid ${yIl.cizgi}`,
  background: '#FFFFFF',
  fontFamily: yazi.kalin,
  fontSize: 15,
  fontWeight: 700,
  color: yIl.metin,
  cursor: 'pointer',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
};

const ilceDom = {
  height: 32,
  padding: '0 28px 0 12px',
  borderRadius: 16,
  border: `1px solid ${yIl.cizgi}`,
  background: '#FFFFFF',
  fontFamily: yazi.kalin,
  fontSize: 13,
  fontWeight: 700,
  color: yIl.metin,
  cursor: 'pointer',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
};

const s = StyleSheet.create({
  baslikYani: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1, minWidth: 0 },
  // Kapalı kutudaki ▾ (#401 KK4): açık listede görünmesin diye seçeneklerde değil, kutunun üstünde.
  secici: { justifyContent: 'center' },
  ilceSecici: { marginLeft: 12 },
  ok: { position: 'absolute', right: 12, fontFamily: yazi.kalin, fontSize: 13, color: yIl.metin, pointerEvents: 'none' },
  dugme: { height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dugmeCerceve: { paddingHorizontal: 16, borderWidth: 1, borderColor: yIl.cizgi, backgroundColor: '#FFFFFF' },
  dugmeVurgu: { paddingHorizontal: 18, backgroundColor: '#FF7A1A' },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 14 },
  basili: { opacity: 0.7 },
  yeniSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 520 },
  yeniAd: { flex: 1 },
  ozet: { fontFamily: yazi.normal, fontSize: 14, color: yIl.ikincil, flexShrink: 1 },
  govde: { gap: 14 },
  arama: { maxWidth: 520, zIndex: 2 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  cip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: yIl.baslikZemin, justifyContent: 'center' },
  cipSecili: { backgroundColor: yIl.metin },
  cipMetin: { fontFamily: yazi.kalin, fontSize: 13, color: yIl.metin },
  cipMetinSecili: { color: '#FFFFFF' },
  hata: { fontFamily: yazi.kalin, fontSize: 13, color: yRenk.hata },
  yardim: { fontFamily: yazi.normal, fontSize: 13, color: yIl.ikincil },
});
