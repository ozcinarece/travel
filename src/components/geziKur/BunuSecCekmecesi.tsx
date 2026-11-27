// #574 KK5–KK7 (UX önerileri kanvası `Kur_v11_Cekmece`): "Bunu seç" çekmecesi. Üstte rota özeti (48 pt kapak, ad 17/800,
// "N gün · M durak" 14 #5B6178); "Ne zaman?" (15/800) ve sağda "Tarihim belli değil" (14/700 Gece); sihirbazın takvimi
// (`AdimNeZaman`, dönüş günü ipucuyla) ve altında "5–6 Aralık · Cumartesi–Pazar · 2 gün" satırı. Yalnız gidiş seçiliyken dönüş
// rotanın gün sayısından gelir (Bunu seç → tarih → Geziyi oluştur = 3 dokunuş). "Tarihim belli değil" sayacı açar (varsayılan
// rotanın gün sayısı). "Kimlerle?" satırı: girişte verilen yol arkadaşı (seçili yuvarlak, dokununca kalkar) ve "+" (davet
// linki; seçilince gezi oluşunca paylaşım açılır). #573 gelene kadar son gezilen arkadaşlar listelenmez. Turuncu "Geziyi oluştur".
// KK7: hazır gezi mevcut "Seyahatime al" aktarımıyla (`geziden_seyahat_ac`), arkadaş rotası mevcut "Seyahatime al"la
// (`paylasimdan_al_kimlik`; tarih seçildiyse ardından tarih kurulur). Bitince seyahatin Gezi sayfası açılır.
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AdimNeZaman } from '@/components/sihirbaz/AdimNeZaman';
import { SeyahatKapagi } from '@/components/seyahatler/SeyahatKapagi';
import { AltPencere } from '@/components/ui/AltPencere';
import { Avatar } from '@/components/ui/Avatar';
import { Foto } from '@/components/ui/Foto';
import type { ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import { cekmeceSecimi, durakSayisi, secimGunVeBaslangic, tarihSatiri } from '@/features/geziKur/geziKur';
import { useGezidenSeyahatAc } from '@/features/icerik/aktarSorgu';
import type { AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { useGezi, useSehirler } from '@/features/icerik/sorgular';
import { usePaylasimdanAl } from '@/features/paylasim/alici';
import { useIcerikSehirSecimi } from '@/features/sihirbaz/girisler';
import { gunSayisiSinirla, type Aralik } from '@/features/sihirbaz/sihirbaz';
import { useTaslakTarihi } from '@/features/sihirbaz/taslak';
import { t } from '@/i18n';
import { minDokunma, renk, yazi } from '@/theme';

import { kurRenk, type Kapak } from './RotaKarti';

export type SecilenRota = { tur: 'gezi'; gezi: AkisGezisi; kapak: Kapak } | { tur: 'arkadas'; paylasim: ArkadasPaylasimi; baslik: string };

export type YolArkadasi = { id: string; ad: string; foto: string | null };

type Props = {
  rota: SecilenRota;
  onKapat: () => void;
  /** KK-ek1: girişte verilen yol arkadaşı (yoksa null). */
  yolArkadasi: YolArkadasi | null;
  onYolArkadasiKaldir: () => void;
};

export function BunuSecCekmecesi({ rota, onKapat, yolArkadasi, onYolArkadasiKaldir }: Props) {
  const rotaGun = rota.tur === 'gezi' ? rota.gezi.gun_sayisi : rota.paylasim.gun_sayisi;
  const durak = rota.tur === 'gezi' ? durakSayisi(rota.gezi) : rota.paylasim.durak_sayisi;
  const baslik = rota.tur === 'gezi' ? rota.gezi.baslik : rota.baslik;
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

  const secim = cekmeceSecimi(aralik, tarihsizGun, rotaGun);
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
        // Seyahat açıldı: tarih kurulamazsa da Gezi sayfası açılır (tarih oradan değişir; ikinci seyahat açılmaz).
        if (secim.tur === 'tarihli' || secim.gun !== rota.paylasim.gun_sayisi) await tarih.mutateAsync({ seyahatId: id, secim }).catch(() => undefined);
      }
      onKapat();
      router.replace({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id, ...(davet || yolArkadasi ? { davet: '1' } : {}) } });
    } catch {
      setHata(t('sihirbaz.nezaman.hata'));
    } finally {
      kilit.current = false;
      setMesgul(false);
    }
  };

  return (
    <AltPencere acik onKapat={onKapat} kapatEtiketi={t('geziKur.kapat')} gorunus="v11" kaydirilir>
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
              setTarihsizGun(gunSayisiSinirla(rotaGun));
            }}
            hitSlop={12}>
            <Text style={s.baglanti}>{t('sihirbaz.nezaman.atla')}</Text>
          </Pressable>
        ) : null}
      </View>
      <AdimNeZaman
        aralik={aralik}
        onAralik={(a) => {
          setTarihsizGun(null);
          setAralik(a);
        }}
        tarihsizGun={tarihsizGun}
        onTarihsizGun={(n) => setTarihsizGun(gunSayisiSinirla(n))}
        ozetSatiri={secim?.tur === 'tarihli' ? tarihSatiri(secim) : null}
      />

      <View style={s.kimler}>
        <Text style={[s.bolum, { marginRight: 4 }]}>{t('geziKur.kimlerle')}</Text>
        {yolArkadasi ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('geziKur.yolArkadasi', { ad: yolArkadasi.ad })} accessibilityState={{ selected: true }} onPress={onYolArkadasiKaldir} testID="yol-arkadasi">
            <Secili>
              <Avatar ad={yolArkadasi.ad} url={yolArkadasi.foto} boyut={40} arkaPlan={kurRenk.acikMavi} harfRengi={kurRenk.lacivert} harfBoyutu={14} yuvarlak />
            </Secili>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={davet ? t('geziKur.davetSecili') : t('geziKur.davetEkle')}
          accessibilityState={{ selected: davet }}
          onPress={() => setDavet((d) => !d)}
          hitSlop={2}
          testID="davet-arti">
          {davet ? (
            <Secili>
              <Arti />
            </Secili>
          ) : (
            <Arti />
          )}
        </Pressable>
      </View>

      {hata ? <Text style={s.hata}>{hata}</Text> : null}
      <View style={{ paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !secim || mesgul, busy: mesgul || veriBekliyor }}
          disabled={!secim || mesgul}
          onPress={olustur}
          style={({ pressed }) => [s.olustur, !secim && s.pasif, pressed && { opacity: 0.85 }]}>
          {mesgul ? <ActivityIndicator color={kurRenk.metin} /> : <Text style={s.olusturMetin}>{t('geziKur.olustur')}</Text>}
        </Pressable>
      </View>
    </AltPencere>
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
