// #432 2/3 (KK2, KK3, KK9, KK-ek; kanvas `Sos_v6_Paylas` ve `Sos_v6_PaylasAcik`): "Geziyi paylaş" çekmecesi.
// Önizleme kartı (seyahat kapağı yer tutucusu, "Ayşe'nin Eskişehir gezisi", "3 gün · 12 durak · 3 kişi gezdi"), "Kişi adlarını
// göster" (varsayılan kapalı), kilitli "Notlar, harcamalar ve sohbet" satırı, turuncu "Linki gönder". Link açıkken üstte
// "Link açık · N kez açıldı", altta kırmızı "Paylaşımı kapat" (sistem onayıyla). En altta davet akışına giden gri satır (KK9).
// #454 inceleme: hata ve bildirimler çekmecenin içinde, "Linki gönder"in üstünde (#317 hata kutusu biçimi); çevrimdışıyken ve
// link okunamazken düğmeler pasif, okuma hatasında "Tekrar dene". 2. inceleme: başarı mesajı kutusuz düz satır (kırmızı kutu
// yalnız hatada), anahtar/kapatma hatasına kendi metni, çevrimdışı nedeni kutuda, iOS'ta mesaj duyurulur (#317 kalıbı).
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useIosDuyuru } from '@/components/ui/EklemeDurumSatiri';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { AltPencere } from '@/components/ui/AltPencere';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { linkiGonder, paylasimLinki, useAcikPaylasim, usePaylasimGuncelle, usePaylasimOlustur } from '@/features/paylasim/sorgular';
import { t } from '@/i18n';
import { ilgiEkli } from '@/lib/ek';
import { onayIste } from '@/lib/onay';
import { anaV5, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  onKapat: () => void;
  seyahat: { id: string; city_label: string };
  /** Paylaşanın görünen adı (önizleme başlığı "Ayşe'nin …"). */
  benimAdim: string | null;
  gunSayisi: number;
  durakSayisi: number;
  kisiSayisi: number;
  /** KK9: "Arkadaş ekle ›" davet akışını açar. */
  onArkadasEkle: () => void;
  /** Bağlantı yokken "Linki gönder", anahtar ve "Paylaşımı kapat" pasif. */
  cevrimdisi: boolean;
};

/** Çekmece kapanma animasyonu bitmeden ikinci Modal açılırsa iOS onu göstermeyebilir. */
export const ARKADAS_GECIKME_MS = 350;

/** "Ayşe'nin Eskişehir gezisi"; ad ek alamıyorsa "Eskişehir gezisi". */
export function paylasimBasligi(ad: string | null, sehir: string): string {
  const ekli = ad ? ilgiEkli(ad) : null;
  return ekli ? t('paylasim.kimin', { ad: ekli, sehir }) : t('paylasim.kiminsiz', { sehir });
}

export function paylasimOzeti(gun: number, durak: number, kisi: number): string {
  return [t('paylasim.gun', { n: gun }), t('paylasim.durak', { n: durak }), t('paylasim.kisi', { n: kisi })].join(' · ');
}

export function PaylasimCekmecesi({ acik, onKapat, seyahat, benimAdim, gunSayisi, durakSayisi, kisiSayisi, onArkadasEkle, cevrimdisi }: Props) {
  const paylasim = useAcikPaylasim(seyahat.id, acik);
  const olustur = usePaylasimOlustur(seyahat.id);
  const guncelle = usePaylasimGuncelle(seyahat.id);
  const link = paylasim.data ?? null;
  // Link yokken anahtar yerel (varsayılan kapalı, KK2); açık linkte linkin değeri.
  const [yerelAdlar, setYerelAdlar] = useState(false);
  const adlarAcik = link ? link.kisi_adlari_acik : yerelAdlar;

  const baslik = paylasimBasligi(benimAdim, seyahat.city_label);
  const ozet = paylasimOzeti(gunSayisi, durakSayisi, kisiSayisi);
  const mesgul = olustur.isPending || guncelle.isPending;
  // Link okunamadıysa "link yok" sanılmaz: yeni link denemesi tek açık link kısıtına takılır, "Paylaşımı kapat" görünmez.
  const okumaHatasi = paylasim.isError;
  const pasif = cevrimdisi || okumaHatasi;
  const ipucu = cevrimdisi ? t('geziSayfasi.cevrimdisi.baglantiYok') : undefined;

  // Hata ve bildirim çekmecenin içinde gösterilir (sayfa bildirimi Modal'ın altında kalır). Hata kırmızı kutuda, başarı düz satırda.
  const [mesaj, setMesaj] = useState<{ metin: string; tur: 'hata' | 'bilgi' } | null>(null);
  const hata = (metin: string) => setMesaj({ metin, tur: 'hata' });
  const bilgi = (metin: string) => setMesaj({ metin, tur: 'bilgi' });
  // Kapandıktan sonra biten bir istek bir sonraki açılışa eski mesaj bırakmasın.
  // (Render sırasında önceki `acik` ile karşılaştırılır; effect içinde setState yok.)
  const [oncekiAcik, setOncekiAcik] = useState(acik);
  if (acik !== oncekiAcik) {
    setOncekiAcik(acik);
    if (acik) setMesaj(null);
  }
  const kapanis = () => {
    setMesaj(null);
    onKapat();
  };
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
  }, []);

  const anahtar = () => {
    const yeni = !adlarAcik;
    setMesaj(null);
    // Açık linkte hemen yazılır (linki açan kişi bir sonraki açılışta görür); hata olursa eski değere döner.
    if (link) guncelle.mutate({ id: link.id, degisiklik: { kisi_adlari_acik: yeni } }, { onError: () => hata(t('paylasim.anahtarHata')) });
    else setYerelAdlar(yeni);
  };

  const gonder = async () => {
    setMesaj(null);
    try {
      const hedef = link ?? (await olustur.mutateAsync(adlarAcik));
      const url = paylasimLinki(hedef.token);
      const sonuc = await linkiGonder(t('paylasim.mesaj', { baslik, ozet: [t('paylasim.gun', { n: gunSayisi }), t('paylasim.durak', { n: durakSayisi })].join(' · '), link: url }), url);
      if (sonuc === 'kopyalandi') bilgi(t('davet.linkKopyalandi'));
    } catch {
      hata(t('paylasim.hata'));
    }
  };

  const kapat = async () => {
    if (!link) return;
    const onay = await onayIste(t('paylasim.paylasimiKapat'), t('paylasim.kapatOnayMetin'), t('paylasim.kapatEvet'), t('genel.vazgec'));
    if (!onay) return;
    setMesaj(null);
    guncelle.mutate({ id: link.id, degisiklik: { acik: false } }, { onSuccess: () => bilgi(t('paylasim.kapatildi')), onError: () => hata(t('paylasim.kapatHata')) });
  };

  const arkadasEkle = () => {
    kapanis();
    zamanlayici.current = setTimeout(onArkadasEkle, ARKADAS_GECIKME_MS);
  };

  // Öncelik: çevrimdışı nedeni, okuma hatası, son işlemin mesajı.
  const hataMetni = cevrimdisi ? t('geziSayfasi.cevrimdisi.baglantiYok') : okumaHatasi ? t('paylasim.okumaHata') : mesaj?.tur === 'hata' ? mesaj.metin : null;
  const bilgiMetni = !hataMetni && mesaj?.tur === 'bilgi' ? mesaj.metin : null;
  useIosDuyuru(hataMetni ?? bilgiMetni);

  return (
    <AltPencere acik={acik} onKapat={kapanis} kapatEtiketi={t('paylasim.kapat')} gorunus="v6" kaydirilir>
      <View style={s.ust}>
        <Text style={s.baslik} accessibilityRole="header">
          {t('paylasim.baslik')}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('paylasim.kapat')} onPress={kapanis} style={s.kapatDugme}>
          <Ikon ad="kapat" boyut={18} renk={renk.metin} kalinlik={2.4} />
        </Pressable>
      </View>

      <View style={s.bolum}>
        <Text style={s.etiket}>{t('paylasim.onizleme')}</Text>
        <View style={s.kart}>
          <SeyahatKapagi kimlik={seyahat.id} yukseklik={112} kose={0} />
          <View style={s.kartGovde}>
            <Text style={s.kartBaslik} numberOfLines={2}>
              {baslik}
            </Text>
            <Text style={s.alt}>{ozet}</Text>
          </View>
        </View>
      </View>

      <View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: adlarAcik, disabled: mesgul || pasif }}
          accessibilityLabel={t('paylasim.kisiAdlari')}
          accessibilityHint={ipucu}
          onPress={anahtar}
          disabled={mesgul || pasif}
          style={[s.satir, pasif && s.pasif]}>
          <View style={s.satirMetin}>
            <Text style={s.satirBaslik}>{t('paylasim.kisiAdlari')}</Text>
            <Text style={s.alt}>{t('paylasim.kisiAdlariAlt', { n: kisiSayisi })}</Text>
            <Text style={s.alt}>{t('paylasim.kisiAdlariUyari')}</Text>
          </View>
          <View testID="kisi-adlari-kutu" style={[s.kutu, adlarAcik && s.kutuSecili]}>{adlarAcik ? <Ikon ad="tik" boyut={16} renk={renk.zemin} kalinlik={3} /> : null}</View>
        </Pressable>
        <View style={[s.satir, s.cizgi]}>
          <View style={s.satirMetin}>
            <Text style={s.satirBaslik}>{t('paylasim.gizli')}</Text>
            <Text style={s.alt}>{t('paylasim.gizliAlt')}</Text>
          </View>
          <View accessible accessibilityRole="image" accessibilityLabel={t('paylasim.kilitli')}>
            <Ikon ad="kilitV6" boyut={22} renk={anaV5.ikincil} kalinlik={2.2} />
          </View>
        </View>
      </View>

      <View style={s.bolum}>
        {link ? (
          <View style={s.durum}>
            <View style={s.nokta} />
            <Text style={s.alt}>
              <Text style={s.durumKoyu}>{t('paylasim.linkAcik')}</Text>
              {` · ${t('paylasim.acildi', { n: link.acilma_sayisi })}`}
            </Text>
          </View>
        ) : null}
        {hataMetni ? (
          <View testID="paylasim-mesaj" style={s.hataKutu} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={s.hataMetin}>{hataMetni}</Text>
          </View>
        ) : null}
        {bilgiMetni ? (
          <Text testID="paylasim-bilgi" style={[s.alt, s.orta]} accessibilityLiveRegion="polite">
            {bilgiMetni}
          </Text>
        ) : null}
        {okumaHatasi ? <Buton baslik={t('paylasim.tekrarDene')} tur="ikincil" onPress={() => paylasim.refetch()} yukleniyor={paylasim.isFetching} pasif={cevrimdisi} ipucu={ipucu} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('paylasim.linkiGonder')}
          accessibilityHint={ipucu}
          accessibilityState={{ disabled: mesgul || paylasim.isLoading || pasif, busy: olustur.isPending }}
          disabled={mesgul || paylasim.isLoading || pasif}
          onPress={gonder}
          style={[s.gonder, pasif && s.pasif]}>
          {olustur.isPending ? <ActivityIndicator color={renk.metin} /> : <Text style={s.gonderMetin}>{t('paylasim.linkiGonder')}</Text>}
        </Pressable>
        {link ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={ipucu}
            accessibilityState={{ disabled: mesgul || pasif }}
            disabled={mesgul || pasif}
            onPress={kapat}
            style={[s.kapatLink, pasif && s.pasif]}>
            <Text style={s.kapatLinkMetin}>{t('paylasim.paylasimiKapat')}</Text>
          </Pressable>
        ) : (
          <Text style={[s.alt, s.orta]}>{t('paylasim.linkAlt')}</Text>
        )}
      </View>

      <Pressable
        accessibilityRole="link"
        onPress={arkadasEkle}
        style={s.arkadas}>
        <Text style={s.arkadasMetin}>
          {t('paylasim.arkadasSoru')}
          {' '}
          <Text style={s.arkadasEkle}>{t('paylasim.arkadasEkle')}</Text>
        </Text>
      </Pressable>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.ekstra, fontSize: 20, letterSpacing: -0.2, color: renk.metin },
  kapatDugme: { width: 44, height: 44, borderRadius: 22, backgroundColor: anaV5.satirZemin, alignItems: 'center', justifyContent: 'center' },
  bolum: { gap: 8 },
  etiket: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.ikincil },
  kart: { borderRadius: 16, borderWidth: 1, borderColor: anaV5.cizgi, overflow: 'hidden' },
  kartGovde: { paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  kartBaslik: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, gap: 12, paddingVertical: 6 },
  cizgi: { borderTopWidth: 1, borderTopColor: anaV5.cizgi },
  satirMetin: { flex: 1, gap: 2 },
  satirBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  kutu: { width: 24, height: 24, borderRadius: 4, borderWidth: 1.5, borderColor: renk.yerTutucu, alignItems: 'center', justifyContent: 'center' },
  kutuSecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  durum: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nokta: { width: 8, height: 8, borderRadius: 4, backgroundColor: renk.basari },
  durumKoyu: { fontFamily: yazi.kalin, color: renk.metin },
  gonder: { minHeight: 52, borderRadius: 26, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  gonderMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  orta: { textAlign: 'center' },
  kapatLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  kapatLinkMetin: { fontFamily: yazi.kalin, fontSize: 15, color: anaV5.kapat },
  arkadas: { minHeight: 44, borderTopWidth: 1, borderTopColor: anaV5.cizgi, paddingTop: 6, alignItems: 'center', justifyContent: 'center' },
  arkadasMetin: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil, textAlign: 'center' },
  arkadasEkle: { fontFamily: yazi.kalin, color: renk.ana },
  pasif: { opacity: 0.4 },
  // #317 hata kutusu (Yer ekle) ile aynı biçim.
  hataKutu: { padding: 10, borderRadius: 12, backgroundColor: renk.uyariZemin },
  hataMetin: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, textAlign: 'center' },
});
