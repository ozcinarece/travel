// #574 KK5–KK7 (UX önerileri kanvası `Kur_v11_Cekmece`): "Bunu seç" çekmecesi. Üstte rota özeti (48 pt kapak, ad 17/800,
// "N gün · M durak" 14 #5B6178); "Ne zaman?" (15/800) ve sağda "Tarihim belli değil" (14/700 Gece); sihirbazın takvimi
// (`AdimNeZaman`, dönüş günü ipucuyla) ve altında "5–6 Aralık · Cumartesi–Pazar · 2 gün" satırı. Yalnız gidiş seçiliyken dönüş
// rotanın gün sayısından gelir (Bunu seç → tarih → Geziyi oluştur = 3 dokunuş). "Tarihim belli değil" sayacı açar (varsayılan
// rotanın gün sayısı). "Kimlerle?" satırı: son gezilen arkadaşlar (en çok 3, seçilebilir; girişteki kişi seçili) ve "+" (davet
// linki; seçilince gezi oluşunca link paylaşımı açılır). Turuncu "Geziyi oluştur"dan sonra seçilenlere #573 uygulama içi daveti
// gider ve "{Gezi} hazır" çekmecesi (`DavetGonderildi`) açılır; davet gitmezse seyahat yine açılır, hata bildirilir.
// KK7: hazır gezi mevcut "Seyahatime al" aktarımıyla (`geziden_seyahat_ac`), arkadaş rotası mevcut "Seyahatime al"la
// (`paylasimdan_al_kimlik`; tarih seçildiyse ardından tarih kurulur). Bitince seyahatin Gezi sayfası açılır.
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { DavetGonderildi } from '@/components/davet/DavetGonderildi';
import { ProfilOnayi } from '@/components/davet/ProfilOnayi';
import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { Foto } from '@/components/ui/Foto';
import type { ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import { useDavetPaylas } from '@/features/davet/paylas';
import { kisiDurumu, useDavetGonder, useGonderilenDavetler } from '@/features/davet/uygulamaIci';
import { cekmeceEnCokGun, cekmeceSecimi, durakSayisi, secimGunVeBaslangic, tarihSatiri } from '@/features/geziKur/geziKur';
import type { Kimlerle, KimlerleKisi } from '@/features/geziKur/kimlerle';
import { useGezidenSeyahatAc } from '@/features/icerik/aktarSorgu';
import type { AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { useGezi, useSehirler } from '@/features/icerik/sorgular';
import { usePaylasimdanAl } from '@/features/paylasim/alici';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { useIcerikSehirSecimi } from '@/features/sihirbaz/girisler';
import { gunSayisiSinirla, tarihDokun, type Aralik } from '@/features/sihirbaz/sihirbaz';
import { useTaslakTarihi } from '@/features/sihirbaz/taslak';
import { t } from '@/i18n';
import { minDokunma, renk, yazi } from '@/theme';

import { kurRenk, type Kapak } from './RotaKarti';

export type SecilenRota = { tur: 'gezi'; gezi: AkisGezisi; kapak: Kapak } | { tur: 'arkadas'; paylasim: ArkadasPaylasimi; baslik: string };

type Props = {
  rota: SecilenRota;
  onKapat: () => void;
  /** KK6 · KK-ek1: "Kimlerle?" seçimi (ekranın; çekmece kapanıp açılınca korunur). */
  kimlerle: Kimlerle;
};

/** Kanvasta karşılığı olmayan davet hatası: genel hata metni (yeni metin yok). */
const davetHatasi = () => Alert.alert(t('genel.hataBaslik'), t('genel.hataMetin'));
/** #649 KK2: tarih kurulamadı (seyahat yine açılır); sihirbazdaki tarih uyarısının metni. */
const tarihHatasi = () => Alert.alert(t('genel.hataBaslik'), t('sihirbaz.nezaman.tarihHata'));

export function BunuSecCekmecesi({ rota, onKapat, kimlerle }: Props) {
  const rotaGun = rota.tur === 'gezi' ? rota.gezi.gun_sayisi : rota.paylasim.gun_sayisi;
  const durak = rota.tur === 'gezi' ? durakSayisi(rota.gezi) : rota.paylasim.durak_sayisi;
  const baslik = rota.tur === 'gezi' ? rota.gezi.baslik : rota.baslik;
  // #649 KK1: hazır gezi en çok 30, arkadaş rotası en çok 60 gün (iki RPC'nin sınırı).
  const enCok = cekmeceEnCokGun(rota.tur);
  const sayiSinirla = (n: number) => Math.min(enCok, gunSayisiSinirla(n));
  const [aralik, setAralik] = useState<Aralik>(null);
  const [tarihsizGun, setTarihsizGun] = useState<number | null>(null);
  const [davet, setDavet] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const kilit = useRef(false);
  const [acilis] = useState(() => Date.now());

  // Hazır gezi: detay (günler, duraklar) ve şehrin seçimi "Seyahatime al"daki yoldan.
  const gezi = useGezi(rota.tur === 'gezi' ? rota.gezi.slug : undefined);
  const sehirler = useSehirler();
  const sehirKaydi = rota.tur === 'gezi' ? sehirler.data?.find((k) => k.id === rota.gezi.sehir_id) : undefined;
  const sehir = useIcerikSehirSecimi(sehirKaydi);
  const yeni = useGezidenSeyahatAc();
  const al = usePaylasimdanAl();
  const tarih = useTaslakTarihi();
  const davetGonder = useDavetGonder();
  // #573 KK5: davet gittiyse "{Gezi} hazır" çekmecesi; kişiler ve durumları.
  const [gonderildi, setGonderildi] = useState<{ id: string; kisiler: KimlerleKisi[] } | null>(null);
  const gonderilen = useGonderilenDavetler(gonderildi?.id);
  const yeniSeyahat = useSeyahat(gonderildi?.id);
  const linkPaylas = useDavetPaylas(yeniSeyahat.data ?? { id: '', invite_token: '', city_label: '' });
  const geziyeGit = (id: string, link: boolean) => {
    onKapat();
    router.replace({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id, ...(link ? { davet: '1' } : {}) } });
  };

  const secim = cekmeceSecimi(aralik, tarihsizGun, rotaGun, enCok);
  const veriBekliyor = rota.tur === 'gezi' && (!gezi.data || !sehir.data) && !gezi.isError && !sehir.isError;

  const olustur = async () => {
    if (!secim || kilit.current) return;
    setHata(null);
    if (rota.tur === 'gezi' && (!gezi.data || !sehir.data)) {
      if (gezi.isError) void gezi.refetch();
      if (sehir.isError) void sehir.refetch();
      setHata(t('sihirbaz.nezaman.hata'));
      return;
    }
    kilit.current = true;
    setMesgul(true);
    try {
      let id: string;
      if (rota.tur === 'gezi') {
        const { gunSayisi, baslangic } = secimGunVeBaslangic(secim);
        const sonuc = await yeni.mutateAsync({ gezi: gezi.data!, sehir: sehir.data!, gunSayisi, baslangic, secim: { tur: 'plan' }, baslangicAni: acilis });
        // #118 KK4: hiçbir mekan çözülemediyse seyahat açılmaz; çekmece açık kalır.
        if (!sonuc.seyahatId) {
          setHata(t('gezi.hicEklenmedi'));
          return;
        }
        id = sonuc.seyahatId;
      } else {
        id = await al.mutateAsync(rota.paylasim.id);
        // Paylaşımdan alınan seyahat tarihsiz ve rotanın gün sayısıyla açılır; seçim farklıysa taslağın tarihi kurulur.
        // Seyahat açıldı: tarih kurulamazsa da Gezi sayfası açılır (tarih oradan değişir; ikinci seyahat açılmaz). #649 KK2: hata söylenir.
        if (secim.tur === 'tarihli' || secim.gun !== rota.paylasim.gun_sayisi) await tarih.mutateAsync({ seyahatId: id, secim }).catch(tarihHatasi);
      }
      // KK6: seçilen arkadaşlara uygulama içi davet. Düşerse seyahat yine açılır, kullanıcıya hata söylenir.
      const kisiler = kimlerle.secilenler;
      if (kisiler.length > 0) {
        try {
          await davetGonder.mutateAsync({ tripId: id, kisiler: kisiler.map((k) => k.id) });
          setGonderildi({ id, kisiler });
          return;
        } catch {
          davetHatasi();
        }
      }
      geziyeGit(id, davet);
    } catch {
      setHata(t('sihirbaz.nezaman.hata'));
    } finally {
      kilit.current = false;
      setMesgul(false);
    }
  };

  if (gonderildi) {
    const kisiler = gonderildi.kisiler.map((k) => ({ ...k, durum: kisiDurumu(gonderilen.data?.get(k.id), false) }));
    return (
      <>
        <DavetGonderildi
          acik
          gezi={baslik}
          kisiler={kisiler}
          onGeziyeGit={() => geziyeGit(gonderildi.id, false)}
          onKapat={() => geziyeGit(gonderildi.id, false)}
          onLinkiPaylas={() => {
            if (yeniSeyahat.data) void linkPaylas.paylas();
          }}
        />
        {linkPaylas.onayAcik ? <ProfilOnayi acik onKapat={linkPaylas.onayKapat} onGonder={linkPaylas.onayla} /> : null}
      </>
    );
  }

  return (
    // PR #612 inceleme 2: gönderim sürerken kaydırma, arka plan ve geri tuşu çekmeceyi kapatmaz (yarım kalan seçim kaybolmasın).
    <AltPencere acik onKapat={() => (kilit.current ? undefined : onKapat())} kapatEtiketi={t('geziKur.kapat')} gorunus="v11" kaydirilir>
      <View style={s.ozet}>
        {rota.tur === 'gezi' && rota.kapak.uri ? (
          <Foto source={{ uri: rota.kapak.uri }} style={s.kucukKapak} contentFit="cover" accessible={false} />
        ) : (
          <SeyahatKapagi kimlik={rota.tur === 'gezi' ? rota.gezi.id : rota.paylasim.id} yukseklik={48} genislik={48} kose={12} />
        )}
        <View style={s.ozetMetin}>
          <Text style={s.ozetBaslik} numberOfLines={2} accessibilityRole="header">
            {baslik}
          </Text>
          <Text style={s.ozetAlt}>{t('geziKur.cekmeceAlt', { gun: rotaGun, durak })}</Text>
        </View>
      </View>

      <View style={s.neZaman}>
        <Text style={s.bolum}>{t('sihirbaz.nezaman.baslik')}</Text>
        {tarihsizGun === null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAralik(null);
              setTarihsizGun(sayiSinirla(rotaGun));
            }}
            hitSlop={12}>
            <Text style={s.baglanti}>{t('sihirbaz.nezaman.atla')}</Text>
          </Pressable>
        ) : null}
      </View>
      <AdimNeZaman
        // Kanvas: dönüş seçilmediyse rotanın gün sayısıyla hesaplanan dönüş de seçili ve arası bantlı görünür. Dokunuşlar gerçek
        // seçimle hesaplanır (gidişten sonraki güne dokunmak dönüşü seçer); "Dönüş günü?" yalnız dönüş seçimi beklenirken.
        aralik={secim?.tur === 'tarihli' ? { gidis: secim.gidis, donus: secim.donus } : aralik}
        // #649 KK1: sınır gerçek seçimden (yalnız gidiş seçiliyken gidişten itibaren `enCok` gün; sonrası geçmiş gün gibi pasif).
        sinirAraligi={aralik}
        enCokGun={enCok}
        dokun={(_g, gun) => tarihDokun(aralik, gun)}
        donusBekleniyor={!!aralik && !aralik.donus && rotaGun > 1}
        onAralik={(a) => {
          setTarihsizGun(null);
          setAralik(a);
        }}
        tarihsizGun={tarihsizGun}
        onTarihsizGun={(n) => setTarihsizGun(sayiSinirla(n))}
        ozetSatiri={secim?.tur === 'tarihli' ? tarihSatiri(secim) : null}
      />

      <KimlerleSatiri kimlerle={kimlerle} davet={davet} onDavet={() => setDavet((d) => !d)} />

      {hata ? <Text style={s.hata}>{hata}</Text> : null}
      <View style={{ paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !secim || mesgul || veriBekliyor, busy: mesgul || veriBekliyor }}
          disabled={!secim || mesgul || veriBekliyor}
          onPress={olustur}
          testID="geziyi-olustur"
          style={({ pressed }) => [s.olustur, !secim && s.pasif, pressed && { opacity: 0.85 }]}>
          {mesgul || (veriBekliyor && !!secim) ? <ActivityIndicator color={kurRenk.metin} /> : <Text style={s.olusturMetin}>{t('geziKur.olustur')}</Text>}
        </Pressable>
      </View>
    </AltPencere>
  );
}

/** Kanvas (`Kur_v11_Cekmece`): yuvarlakların zemini ve harfi sırayla (M #C9D2F2/#152A6B, A #152A6B/beyaz, D #E3F4EC/#0E7A52). */
const KIMLER_YUZ: readonly (readonly [string, string])[] = [
  [kurRenk.acikMavi, kurRenk.lacivert],
  [kurRenk.lacivert, kurRenk.beyaz],
  ['#E3F4EC', '#0E7A52'],
];

/**
 * KK6 · KK-ek1: "Kimlerle?" satırı — son gezilen arkadaşlar (40 pt yuvarlak, en çok 3; seçili olan Mandalina halka + tik;
 * dokunma alanı 44 pt) ve isteğe bağlı "+" (davet linki). Sihirbaz da aynı satırı kullanır ("+" yok).
 */
export function KimlerleSatiri({ kimlerle, davet, onDavet }: { kimlerle: Pick<Kimlerle, 'kisiler' | 'secili' | 'degistir'>; davet?: boolean; onDavet?: () => void }) {
  return (
    <View style={s.kimler}>
      <Text style={[s.bolum, { marginRight: 4 }]}>{t('geziKur.kimlerle')}</Text>
      {kimlerle.kisiler.map((k, i) => {
        const sec = kimlerle.secili.has(k.id);
        const [zemin, harf] = KIMLER_YUZ[i % KIMLER_YUZ.length];
        const yuz = <Avatar ad={k.ad} url={k.foto} boyut={40} arkaPlan={zemin} harfRengi={harf} harfBoyutu={14} yuvarlak />;
        return (
          <Pressable
            key={k.id}
            accessibilityRole="button"
            accessibilityLabel={t(sec ? 'geziKur.yolArkadasi' : 'geziKur.kisiSec', { ad: k.ad })}
            accessibilityState={{ selected: sec }}
            onPress={() => kimlerle.degistir(k.id)}
            hitSlop={4}
            testID={`kimlerle-${k.id}`}>
            {sec ? <Secili>{yuz}</Secili> : yuz}
          </Pressable>
        );
      })}
      {onDavet ? (
        <Pressable accessibilityRole="button" accessibilityLabel={davet ? t('geziKur.davetSecili') : t('geziKur.davetEkle')} accessibilityState={{ selected: !!davet }} onPress={onDavet} hitSlop={2} testID="davet-arti">
          {davet ? (
            <Secili>
              <Arti />
            </Secili>
          ) : (
            <Arti />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Kanvas: seçili yuvarlak — 2,5 pt beyaz boşluk ve 2 pt Mandalina halka, sağ altta 16 pt Mandalina tik rozeti. */
function Secili({ children }: { children: ReactNode }) {
  return (
    <View style={s.halka}>
      <View style={s.halkaIc}>
        {children}
        <View style={s.tik}>
          <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke={kurRenk.metin} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d="M5 12.5l4.5 4.5L19 7.5" />
          </Svg>
        </View>
      </View>
    </View>
  );
}

/** Kanvas: 40 pt kesik çizgili (1,5 pt #9AA6C8) yuvarlak, ortada 18 pt Gece "+". */
function Arti() {
  return (
    <View style={s.arti}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={kurRenk.lacivert} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d="M12 5v14M5 12h14" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  ozet: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kucukKapak: { width: 48, height: 48, borderRadius: 12 },
  ozetMetin: { flex: 1, gap: 2 },
  ozetBaslik: { fontFamily: yazi.ekstra, fontSize: 17, color: kurRenk.metin },
  ozetAlt: { fontFamily: yazi.normal, fontSize: 14, color: kurRenk.ikincil },
  neZaman: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 16, paddingBottom: 8 },
  bolum: { fontFamily: yazi.ekstra, fontSize: 15, color: kurRenk.metin },
  baglanti: { fontFamily: yazi.kalin, fontSize: 14, color: kurRenk.lacivert },
  kimler: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, minHeight: minDokunma },
  // 40 pt yuvarlak + 2,5 pt boşluk + 2 pt halka; düzende 40 pt yer tutar (kanvastaki box-shadow gibi).
  halka: { width: 49, height: 49, margin: -4.5, borderRadius: 24.5, borderWidth: 2, borderColor: kurRenk.turuncu, alignItems: 'center', justifyContent: 'center' },
  halkaIc: { width: 40, height: 40 },
  tik: { position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: kurRenk.turuncu, borderWidth: 2, borderColor: kurRenk.beyaz, alignItems: 'center', justifyContent: 'center' },
  arti: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9AA6C8', backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  hata: { fontFamily: yazi.yari, fontSize: 13, color: renk.uyari, textAlign: 'center', paddingTop: 12 },
  olustur: { height: 52, borderRadius: 26, backgroundColor: kurRenk.turuncu, alignItems: 'center', justifyContent: 'center' },
  pasif: { opacity: 0.4 },
  olusturMetin: { fontFamily: yazi.kalin, fontSize: 16, color: kurRenk.metin },
});
