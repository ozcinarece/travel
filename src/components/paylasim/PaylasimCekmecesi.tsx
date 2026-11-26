// #432 2/3 (KK2, KK3, KK9, KK-ek; kanvas `Sos_v6_Paylas` ve `Sos_v6_PaylasAcik`): "Geziyi paylaş" çekmecesi.
// Önizleme kartı (seyahat kapağı yer tutucusu, "Ayşe'nin Eskişehir gezisi", "3 gün · 12 durak · 3 kişi gezdi"), kilitli "Notlar, harcamalar ve sohbet" satırı, turuncu "Linki gönder". Link açıkken üstte
// "Link açık · N kez açıldı", altta kırmızı "Paylaşımı kapat" (sistem onayıyla). En altta davet akışına giden gri satır (KK9).
// #454 inceleme: hata ve bildirimler çekmecenin içinde, "Linki gönder"in üstünde (#317 hata kutusu biçimi); çevrimdışıyken ve
// link okunamazken düğmeler pasif, okuma hatasında "Tekrar dene". 2. inceleme: başarı mesajı kutusuz düz satır (kırmızı kutu
// yalnız hatada), anahtar/kapatma hatasına kendi metni, çevrimdışı nedeni kutuda, iOS'ta mesaj duyurulur (#317 kalıbı).
// 3. inceleme: iOS duyurusu yalnız çekmece açıkken (kapalıyken susar, çevrimdışı açılınca okunur); link okunurken anahtar
// pasif ve "link yok" satırı yerine yükleniyor göstergesi; "Arkadaş ekle ›" pencere açtığı için düğme rolünde.
// #510 (Ece kararı, 26 Kasım): "Kişi adlarını göster" anahtarı kalktı; linkte yalnız paylaşanın adı ve "{n} kişi gezdi" yazar.
// #515 2. inceleme (kanvas `Sos_v6_Paylas` sürüm 43): anahtarın yerinde dokunulmaz bilgi satırı "Linkte senin adın görünür";
// önizleme kartı alıcı ekranıyla aynı: turuncu "Ayşe paylaştı", altında seyahat adı ya da "Eskişehir gezisi".
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useIosDuyuru } from '@/components/ui/EklemeDurumSatiri';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { AltPencere } from '@/components/ui/AltPencere';
import { Buton } from '@/components/ui/Buton';
import { Ikon } from '@/components/ui/Ikon';
import { aliciBasligi, ilkAd, paylasimOzeti, type KisiKipi } from '@/features/paylasim/baslik';
import { linkiGonder, paylasimLinki, useAcikPaylasim, usePaylasimGuncelle, usePaylasimOlustur, type PaylasimKaynagi } from '@/features/paylasim/sorgular';
import { t } from '@/i18n';
import { ilgiEkli } from '@/lib/ek';
import { onayIste } from '@/lib/onay';
import { anaV5, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  onKapat: () => void;
  seyahat: { id: string; city_label: string; name?: string | null };
  /** Paylaşanın görünen adı; kartta ve mesajda yalnız ilk adı kullanılır (#530 inceleme 1). */
  benimAdim: string | null;
  gunSayisi: number;
  durakSayisi: number;
  /** #530 inceleme 5: null = üye listesi yükleniyor; "Linki gönder" pasif. */
  kisiSayisi: number | null;
  /** #517 KK3: plan "gidiyor", gezi "geziyor", bitti "gezdi". */
  kisiKip: KisiKipi;
  /** #517 KK8: çekmece nereden açıldı (olay `meta.kaynak`). */
  kaynak?: PaylasimKaynagi;
  /** KK9: "Arkadaş ekle ›" davet akışını açar. */
  onArkadasEkle: () => void;
  /** Bağlantı yokken "Linki gönder" ve "Paylaşımı kapat" pasif. */
  cevrimdisi: boolean;
};

/** Çekmece kapanma animasyonu bitmeden ikinci Modal açılırsa iOS onu göstermeyebilir. */
export const ARKADAS_GECIKME_MS = 350;

/** "Ayşe'nin Eskişehir gezisi"; ad ek alamıyorsa "Eskişehir gezisi". */
export function paylasimBasligi(ad: string | null, sehir: string): string {
  const ekli = ad ? ilgiEkli(ad) : null;
  return ekli ? t('paylasim.kimin', { ad: ekli, sehir }) : t('paylasim.kiminsiz', { sehir });
}

export { paylasimOzeti };

export function PaylasimCekmecesi({ acik, onKapat, seyahat, benimAdim, gunSayisi, durakSayisi, kisiSayisi, kisiKip, kaynak = 'menu', onArkadasEkle, cevrimdisi }: Props) {
  const paylasim = useAcikPaylasim(seyahat.id, acik);
  const olustur = usePaylasimOlustur(seyahat.id, kaynak);
  const guncelle = usePaylasimGuncelle(seyahat.id);
  const link = paylasim.data ?? null;

  // Paylaşım mesajındaki başlık ("Ayşe'nin Eskişehir gezisi") aynı kalır; kart alıcının göreceği gibidir.
  // #530 inceleme 1: alıcı sunucudan yalnız ilk adı alır; kart ve mesaj da yalnız ilk adı kullanır.
  const ad = ilkAd(benimAdim);
  const baslik = paylasimBasligi(ad, seyahat.city_label);
  const kartBasligi = aliciBasligi({ ad: seyahat.name ?? null, sehir: seyahat.city_label });
  const kisiHazir = kisiSayisi !== null;
  const ozet = paylasimOzeti(gunSayisi, durakSayisi, kisiSayisi ?? 1, kisiKip);
  // #517 KK-ek1 (#515 incelemesi): adım yoksa linkte ad görünmez; "Linkte senin adın görünür" satırı da gösterilmez.
  const adVar = !!ad;
  const mesgul = olustur.isPending || guncelle.isPending;
  // Link okunamadıysa "link yok" sanılmaz: yeni link denemesi tek açık link kısıtına takılır, "Paylaşımı kapat" görünmez.
  const okumaHatasi = paylasim.isError;
  const pasif = cevrimdisi || okumaHatasi;
  // Link okunurken "link yok" sanılmasın: durum satırının yerinde yükleniyor göstergesi.
  const linkYukleniyor = paylasim.isLoading;
  // #530 inceleme 5: link ya da üye listesi gelmeden "Linki gönder" basılamaz (mesaj kişi sayısız gitmesin).
  const gonderBekliyor = paylasim.isLoading || !kisiHazir;
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

  const gonder = async () => {
    setMesaj(null);
    try {
      const hedef = link ?? (await olustur.mutateAsync());
      const url = paylasimLinki(hedef.token);
      const sonuc = await linkiGonder(t('paylasim.mesaj', { baslik, ozet, link: url }), url);
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
  // Çekmece sayfada hep bağlı; kapalıyken duyurmaz, açılınca (null → metin) mevcut neden okunur.
  useIosDuyuru(acik ? (hataMetni ?? bilgiMetni) : null);

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
            {adVar ? <Text style={s.paylasti}>{t('paylasim.paylasti', { ad: ad ?? '' })}</Text> : null}
            <Text style={s.kartBaslik} numberOfLines={2}>
              {kartBasligi}
            </Text>
            <Text style={s.alt}>{ozet}</Text>
          </View>
        </View>
      </View>

      <View>
        {adVar ? (
          // #517 KK-ek2: ekran okuyucu satırı tek seferde okur.
          <View testID="paylasim-ad-satiri" style={s.satir} accessible accessibilityLabel={`${t('paylasim.adinGorunur')}. ${t('paylasim.adinGorunurAlt')}`}>
            <View style={s.satirMetin}>
              <Text style={s.satirBaslik}>{t('paylasim.adinGorunur')}</Text>
              <Text style={s.alt}>{t('paylasim.adinGorunurAlt')}</Text>
            </View>
            <Ikon ad="kisiV6" boyut={22} renk={anaV5.ikincil} kalinlik={2.2} />
          </View>
        ) : null}
        <View
          testID="paylasim-kilit-satiri"
          style={[s.satir, adVar && s.satirCizgi]}
          accessible
          accessibilityLabel={`${t('paylasim.gizli')}. ${t('paylasim.gizliAlt')}. ${t('paylasim.kilitli')}`}>
          <View style={s.satirMetin}>
            <Text style={s.satirBaslik}>{t('paylasim.gizli')}</Text>
            <Text style={s.alt}>{t('paylasim.gizliAlt')}</Text>
          </View>
          <Ikon ad="kilitV6" boyut={22} renk={anaV5.ikincil} kalinlik={2.2} />
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
          accessibilityState={{ disabled: mesgul || gonderBekliyor || pasif, busy: olustur.isPending }}
          disabled={mesgul || gonderBekliyor || pasif}
          onPress={gonder}
          style={[s.gonder, (pasif || gonderBekliyor) && s.pasif]}>
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
        ) : linkYukleniyor ? (
          <ActivityIndicator testID="paylasim-yukleniyor" color={anaV5.ikincil} accessibilityLabel={t('genel.yukleniyor')} />
        ) : (
          <Text style={[s.alt, s.orta]}>{t('paylasim.linkAlt')}</Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
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
  paylasti: { fontFamily: yazi.kalin, fontSize: 13, color: anaV5.adim },
  kartBaslik: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, gap: 12, paddingVertical: 6 },
  satirCizgi: { borderTopWidth: 1, borderTopColor: anaV5.cizgi },
  satirMetin: { flex: 1, gap: 2 },
  satirBaslik: { fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
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
