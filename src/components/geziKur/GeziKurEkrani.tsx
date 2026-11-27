// #574 Gezi oluşturma v11 (UX önerileri kanvası "Gezi oluşturma v11 · ONAYLI": `Kur_v11_Acilis`, `Kur_v11_Sehir`).
// KK2 açılış: geri oku, "Nasıl bir gezi?" (26/800), 56 pt "Hangi şehir?" kutusu (köşe 16, 2 pt #E4E7EE kenar; doluyken Gece),
// süzgeç çipleri (2 gün · 3–5 gün · Lezzet · Doğa · Kültür; 36 pt, seçili Gece), hazır geziler (Keşfet akışının sırasıyla),
// "Arkadaşlarından" rafı (#533 açık paylaşımlar) ve en altta "Kendi rotanı kur".
// KK3 şehir yazılınca: lacivert "{Şehir} için kendi rotanı kur" satırı, "{Şehir} rotaları", arkadaşların o şehirdeki rotaları;
// her harfte süzülür. Hazır gezi yoksa "Bu şehir için hazır rota yok, kendi rotanı kur".
// "Bunu seç" (ya da arkadaş kartı) → çekmece (`BunuSecCekmecesi`). Google'a istek yok (yalnız kendi tablolarımız).
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Buton } from '@/components/ui/Buton';
import { useArkadaslarim, useArkadasPaylasimlari, type ArkadasPaylasimi } from '@/features/arkadaslar/sorgular';
import {
  AMAC_SUZGECLERI,
  arkadasRotalari,
  BOS_SUZGEC,
  durakSayisi,
  geziSuz,
  gidenArkadaslar,
  GUN_SUZGECLERI,
  sehirAdi,
  sehirBul,
  sehirGezileri,
  type Suzgec,
} from '@/features/geziKur/geziKur';
import { kapakVeAtif } from '@/features/icerik/kapakAtfi';
import { useKesfetAkisi, type AkisGezisi } from '@/features/icerik/kesfetAkisi';
import { useSehirler } from '@/features/icerik/sorgular';
import { t } from '@/i18n';
import { minDokunma, renk, yazi } from '@/theme';

import { BunuSecCekmecesi, type SecilenRota, type YolArkadasi } from './BunuSecCekmecesi';
import { ArkadasRotaKarti, kurRenk, RotaKarti, type Kapak } from './RotaKarti';

/** "Kendi rotanı kur": rehberli şehir seçiliyse sihirbaz 2. adımdan, değilse yazılan metin Nereye'de aranmış ya da boş. */
export type KendiRotaGirisi = { sehirId: string } | { metin: string } | null;

type Props = {
  /** KK1 · KK-ek2: ana sayfa aramasından ya da profilden gelen rehberli şehir (kutu dolu açılır). */
  sehirId?: string;
  /** KK-ek1: yol arkadaşı olarak seçili gelecek kişi. */
  arkadas?: string;
  onKendiRota: (g: KendiRotaGirisi) => void;
};

export function GeziKurEkrani({ sehirId, arkadas, onKendiRota }: Props) {
  const akis = useKesfetAkisi();
  const paylasimlar = useArkadasPaylasimlari();
  const sehirler = useSehirler();
  const [yazilan, setYazilan] = useState<string | null>(null);
  const baslangicSehri = sehirId ? sehirler.data?.find((s) => s.id === sehirId) : undefined;
  const sorgu = yazilan ?? baslangicSehri?.ad ?? '';
  const [suzgec, setSuzgec] = useState<Suzgec>(BOS_SUZGEC);
  const [secilen, setSecilen] = useState<SecilenRota | null>(null);
  const [arkadasId, setArkadasId] = useState<string | null>(arkadas ?? null);
  const arkadaslar = useArkadaslarim(!!arkadasId);
  const yolArkadasi: YolArkadasi | null = useMemo(() => {
    const a = arkadasId ? arkadaslar.data?.find((k) => k.user_id === arkadasId) : undefined;
    return a ? { id: a.user_id, ad: a.ad, foto: a.foto } : null;
  }, [arkadasId, arkadaslar.data]);

  const geziler = useMemo(() => akis.data ?? [], [akis.data]);
  const arkadasListesi = useMemo(() => paylasimlar.data ?? [], [paylasimlar.data]);
  const yazili = sorgu.trim().length > 0;
  const sehir = useMemo(() => (yazili ? sehirBul(sorgu, sehirler.data) : undefined), [yazili, sorgu, sehirler.data]);
  const gorunenGeziler = useMemo(() => (yazili ? sehirGezileri(geziler, sehir) : geziSuz(geziler, suzgec)), [yazili, geziler, sehir, suzgec]);
  const gorunenArkadaslar = useMemo(() => arkadasRotalari(arkadasListesi, yazili ? sorgu : '', sehir), [arkadasListesi, yazili, sorgu, sehir]);
  // Arkadaşın yüz rengi kişiye göre sabit (aynı kişinin kartları aynı renkte; ana sayfa rafıyla aynı kural).
  const kisiSirasi = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of arkadasListesi) if (!m.has(p.paylasan)) m.set(p.paylasan, m.size);
    return m;
  }, [arkadasListesi]);

  const kapakBul = (g: AkisGezisi): Kapak => {
    const s = sehirler.data?.find((x) => x.id === g.sehir_id);
    return kapakVeAtif([g, ...(s ? [s] : [])]);
  };
  const geri = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const kendiRota = () => {
    if (!yazili) return onKendiRota(null);
    onKendiRota(sehir ? { sehirId: sehir.id } : { metin: sorgu.trim() });
  };
  const arkadasSec = (p: ArkadasPaylasimi) => setSecilen({ tur: 'arkadas', paylasim: p, baslik: p.ad?.trim() || t('geziKur.arkadasBaslik', { sehir: p.sehir, n: p.gun_sayisi }) });

  const rotaKartlari = (yukseklik: number) =>
    gorunenGeziler.map((g) => (
      <RotaKarti
        key={g.id}
        id={g.id}
        ad={g.baslik}
        alt={t('geziKur.kartAlt', { gun: g.gun_sayisi, durak: durakSayisi(g) })}
        kapak={kapakBul(g)}
        gidenler={gidenArkadaslar(g, arkadasListesi)}
        yukseklik={yukseklik}
        onSec={() => setSecilen({ tur: 'gezi', gezi: g, kapak: kapakBul(g) })}
      />
    ));

  const arkadasRafi = (tumu: boolean) =>
    gorunenArkadaslar.length > 0 ? (
      <View testID="arkadaslardan">
        <View style={s.rafUst}>
          <Text accessibilityRole="header" style={s.bolumBaslik}>
            {t('geziKur.arkadaslardan')}
          </Text>
          {tumu ? (
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)/arkadaslar')} hitSlop={8} style={s.tumu}>
              <Text style={s.tumuMetin}>{t('anasayfa.tumu')}</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.raf}>
          {gorunenArkadaslar.map((p) => (
            <ArkadasRotaKarti key={p.id} p={p} sira={kisiSirasi.get(p.paylasan) ?? 0} onSec={() => arkadasSec(p)} />
          ))}
        </ScrollView>
      </View>
    ) : null;

  const akisDurumu = akis.isLoading ? (
    <ActivityIndicator color={renk.ana} style={{ marginTop: 24 }} />
  ) : akis.isError && !akis.data ? (
    <View style={s.hataKutu}>
      <Text style={s.bilgi}>{t('geziKur.rotaHata')}</Text>
      <Buton baslik={t('kesfetAkisi.tekrarDene')} tur="ikincil" onPress={() => void akis.refetch()} yukleniyor={akis.isFetching} />
    </View>
  ) : null;

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.icerik}>
        <View style={s.ust}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('genel.geri')} onPress={geri} hitSlop={8} style={s.geri}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={kurRenk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <Path d="M15 5l-7 7 7 7" />
            </Svg>
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('geziKur.baslik')}
        </Text>
        <View style={[s.kutu, yazili && s.kutuDolu]}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={kurRenk.lacivert} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
            <Circle cx={12} cy={10} r={2.5} />
          </Svg>
          <TextInput
            accessibilityLabel={t('geziKur.sehirEtiket')}
            placeholder={t('geziKur.sehirYer')}
            placeholderTextColor={kurRenk.ikincil}
            value={sorgu}
            onChangeText={setYazilan}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            selectionColor={kurRenk.turuncu}
            style={[s.girdi, yazili && s.girdiDolu]}
          />
          {yazili ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('geziKur.sehirTemizle')} onPress={() => setYazilan('')} hitSlop={11} style={s.temizle}>
              <Text style={s.temizleMetin}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {yazili ? (
          <>
            <KendiRotaSatiri baslik={t('geziKur.sehirleKur', { sehir: sehirAdi(sorgu, sehir) })} onPress={kendiRota} ust={12} />
            {akisDurumu ??
              (gorunenGeziler.length > 0 ? (
                <>
                  <Text accessibilityRole="header" style={[s.bolumBaslik, s.sehirBaslik]}>
                    {t('geziKur.sehirRotalari', { sehir: sehirAdi(sorgu, sehir) })}
                  </Text>
                  {rotaKartlari(210)}
                </>
              ) : (
                <Text style={[s.bilgi, s.sehirBaslik]}>{t('geziKur.hazirYok')}</Text>
              ))}
            {arkadasRafi(false)}
          </>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cipler} keyboardShouldPersistTaps="handled">
              {GUN_SUZGECLERI.map((g) => (
                <Cip key={g} metin={t(`geziKur.suzgec.${g}`)} secili={suzgec.gun === g} onPress={() => setSuzgec((x) => ({ ...x, gun: x.gun === g ? null : g }))} />
              ))}
              {AMAC_SUZGECLERI.map((a) => (
                <Cip key={a} metin={t(`geziKur.suzgec.${a}`)} secili={suzgec.amac === a} onPress={() => setSuzgec((x) => ({ ...x, amac: x.amac === a ? null : a }))} />
              ))}
            </ScrollView>
            {akisDurumu ?? (gorunenGeziler.length > 0 ? rotaKartlari(236) : <Text style={[s.bilgi, s.sehirBaslik]}>{t('geziKur.suzgecBos')}</Text>)}
            {arkadasRafi(true)}
            <KendiRotaSatiri baslik={t('geziKur.kendiKur')} onPress={kendiRota} ust={22} />
          </>
        )}
      </ScrollView>
      {secilen ? <BunuSecCekmecesi rota={secilen} onKapat={() => setSecilen(null)} yolArkadasi={yolArkadasi} onYolArkadasiKaldir={() => setArkadasId(null)} /> : null}
    </SafeAreaView>
  );
}

function Cip({ metin, secili, onPress }: { metin: string; secili: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onPress} hitSlop={4} style={[s.cip, secili && s.cipSecili]}>
      <Text style={[s.cipMetin, secili && s.cipMetinSecili]}>{metin}</Text>
    </Pressable>
  );
}

/** KK3 (kanvas `Kur_v11_Sehir`): lacivert satır — "+" (22 pt), başlık 16/800, "Tarihi seç, yerleri sen ekle" 13 (%85), sağda ok. */
function KendiRotaSatiri({ baslik, onPress, ust }: { baslik: string; onPress: () => void; ust: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.kendi, { marginTop: ust }, pressed && { opacity: 0.9 }]} testID="kendi-rota">
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={kurRenk.beyaz} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d="M12 5v14M5 12h14" />
      </Svg>
      <View style={{ flex: 1 }}>
        <Text style={s.kendiBaslik}>{baslik}</Text>
        <Text style={s.kendiAlt}>{t('geziKur.kendiAlt')}</Text>
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={kurRenk.beyaz} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d="M9 6l6 6-6 6" />
      </Svg>
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: kurRenk.beyaz },
  icerik: { paddingBottom: 32 },
  ust: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 6 },
  geri: { width: minDokunma, height: minDokunma, marginLeft: -11, alignItems: 'center', justifyContent: 'center' },
  baslik: { paddingTop: 4, paddingHorizontal: 16, fontFamily: yazi.ekstra, fontSize: 26, letterSpacing: -0.26, color: kurRenk.metin },
  kutu: { marginTop: 14, marginHorizontal: 16, height: 56, borderRadius: 16, borderWidth: 2, borderColor: kurRenk.cizgi, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  kutuDolu: { borderColor: kurRenk.lacivert },
  girdi: { flex: 1, height: '100%', fontFamily: yazi.orta, fontSize: 17, color: kurRenk.metin, padding: 0 },
  girdiDolu: { fontFamily: yazi.kalin },
  temizle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#C8CDD9', alignItems: 'center', justifyContent: 'center' },
  temizleMetin: { fontSize: 13, lineHeight: 16, color: kurRenk.beyaz },
  cipler: { flexDirection: 'row', gap: 8, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 4 },
  cip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: kurRenk.cizgi, justifyContent: 'center' },
  cipSecili: { backgroundColor: kurRenk.lacivert, borderColor: kurRenk.lacivert },
  cipMetin: { fontFamily: yazi.yari, fontSize: 14, color: kurRenk.metin },
  cipMetinSecili: { color: kurRenk.beyaz },
  kendi: { marginHorizontal: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: kurRenk.lacivert, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kendiBaslik: { fontFamily: yazi.ekstra, fontSize: 16, color: kurRenk.beyaz },
  kendiAlt: { fontFamily: yazi.normal, fontSize: 13, color: kurRenk.beyaz, opacity: 0.85 },
  bolumBaslik: { fontFamily: yazi.ekstra, fontSize: 19, color: kurRenk.metin },
  sehirBaslik: { paddingTop: 18, paddingHorizontal: 16 },
  rafUst: { paddingTop: 22, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tumu: { minHeight: minDokunma, justifyContent: 'center', marginVertical: -12 },
  tumuMetin: { fontFamily: yazi.kalin, fontSize: 14, color: kurRenk.lacivert },
  raf: { gap: 12, paddingTop: 12, paddingHorizontal: 16 },
  bilgi: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 21, color: kurRenk.ikincil },
  hataKutu: { gap: 12, paddingTop: 18, paddingHorizontal: 16 },
});
