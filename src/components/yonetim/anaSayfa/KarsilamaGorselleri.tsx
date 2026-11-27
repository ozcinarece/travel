import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { KapakAtfi } from '@/components/icerik/KapakAtfi';
import { Foto } from '@/components/ui/Foto';
import { LogoYazi } from '@/components/ui/Logo';
import { kapakAtfiOku } from '@/features/icerik/kapakAtfi';
import { KARSILAMA_EN_COK, karsilamaGuncelle, karsilamaKalan, type TaslakBolum } from '@/features/yonetim/anaSayfa';
import type { FotoKaynagi } from '@/features/yonetim/fotolar';
import { tasi } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import type { KarsilamaKapagi } from '@/lib/anaSayfa';
import { anaV5, renk, yazi } from '@/theme';

import { Alan, AlanSatiri, MetinKutusu, SecimKutusu } from '../Form';
import { Hap } from '../Hap';
import { KapakAtifSatiri } from '../KapakAtifSatiri';
import { dosyaSec, useDosyaBirakma, useSuruklenen } from '../surukle';
import { yRenk } from '../tema';
import { Anahtar } from './BolumSatiri';

type Props = {
  /** Karşılama satırı; ilk görsel eklenene kadar yok. */
  bolum: TaslakBolum | null;
  kapaklar: KarsilamaKapagi[];
  /** Seçilen dosyaları yükleyip sona ekler (satır yoksa kurar). */
  onYukle: (dosyalar: File[]) => Promise<void>;
  /** Görsel listesini yazar (sıra, sil, kaynak, atıf). */
  onYaz: (kapaklar: KarsilamaKapagi[]) => void;
  onAcik: (acik: boolean) => void;
};

const TUTAMAC = 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01';
const YUKLE = 'M12 16V4M6 10l6-6 6 6M4 20h16';
const KAYNAKLAR: FotoKaynagi[] = ['kendi', 'telifsiz', 'izinli'];

/** Adresin son parçası ("1a2b3c4d-kis.webp"). */
function dosyaAdi(url: string): string {
  const son = url.split('/').pop() ?? url;
  try {
    return decodeURIComponent(son);
  } catch {
    return son;
  }
}

/**
 * #586 KK2 · KK3: Ana sayfa › "Karşılama görselleri" — panelin en üstünde sabit satır (sürüklenmez). Mevcut panel dili: bölüm
 * satırı ve anahtarı, şehir fotoğraflarının kesikli yükleme şeridi (çoklu seçim, bırakma), içerik satırı (tutamaç = sıra),
 * kaynak seçimi, kapak atıf satırı. "Önizle" kartı telefon genişliğinde gösterir (UX önerileri kanvası `Ana_v9_GeziYok`).
 */
export function KarsilamaGorselleri({ bolum, kapaklar, onYukle, onYaz, onAcik }: Props) {
  const [mesgul, setMesgul] = useState(false);
  const [onizleme, setOnizleme] = useState(false);
  const [onizlenen, setOnizlenen] = useState(0);
  // Sınırı aşan dosyalar yüklenmez; kaçının alındığı söylenir.
  const [fazla, setFazla] = useState(0);
  const yukleAlani = useRef<View>(null);
  const kalan = karsilamaKalan(kapaklar);
  const yukle = async (dosyalar: File[]) => {
    if (!dosyalar.length || mesgul || !kalan) return;
    setFazla(Math.max(0, dosyalar.length - kalan));
    setMesgul(true);
    try {
      await onYukle(dosyalar.slice(0, kalan));
    } finally {
      setMesgul(false);
    }
  };
  useDosyaBirakma(yukleAlani, yukle);
  const ozet = kapaklar.length ? ty('anaSayfa.karsilama.ozet', { n: kapaklar.length, en: KARSILAMA_EN_COK }) : ty('anaSayfa.karsilama.ozetBos');
  const gosterilen = kapaklar.length ? kapaklar[onizlenen % kapaklar.length] : null;

  return (
    <View style={[s.kap, bolum && !bolum.acik && s.kapali]} testID="karsilama-gorselleri">
      <View style={s.satir}>
        <View style={s.metinler}>
          <Text style={s.baslik} numberOfLines={1}>
            {ty('anaSayfa.karsilama.baslik')}
            <Text style={s.tur}>{` · ${ty('anaSayfa.tur.karsilama')}`}</Text>
          </Text>
          <Text style={s.ozet} numberOfLines={1}>
            {ozet}
          </Text>
        </View>
        {bolum ? <Anahtar acik={bolum.acik} etiket={ty('anaSayfa.acikKapali', { baslik: ty('anaSayfa.karsilama.baslik') })} onDegis={onAcik} /> : null}
        <Hap kucuk baslik={ty(onizleme ? 'anaSayfa.karsilama.onizleKapat' : 'gezi.onizle')} onPress={() => setOnizleme(!onizleme)} />
      </View>
      <View style={s.govde}>
        <Pressable
          ref={yukleAlani}
          accessibilityRole="button"
          accessibilityLabel={ty('anaSayfa.karsilama.ekle')}
          accessibilityState={{ disabled: !kalan || mesgul, busy: mesgul }}
          onPress={() => kalan && !mesgul && dosyaSec(true, yukle)}
          style={[s.yukle, !kalan && s.pasif]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={yRenk.ikincil} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d={YUKLE} />
          </Svg>
          <Text style={s.yukleMetin}>
            {mesgul ? ty('sehir.foto.yukleniyor') : kalan ? ty('anaSayfa.karsilama.kural', { n: kalan }) : ty('anaSayfa.karsilama.dolu', { en: KARSILAMA_EN_COK })}
            {kalan && !mesgul ? <Text style={s.kod}>{' icerik/anasayfa/'}</Text> : null}
          </Text>
        </Pressable>
        {fazla ? (
          <Text accessibilityRole="alert" style={s.hata}>
            {ty('anaSayfa.karsilama.fazla', { n: fazla, en: KARSILAMA_EN_COK })}
          </Text>
        ) : null}
        {/* Yükleme sürerken satırlar kilitli: yükleme bitince liste tek yazımla güncellenir, araya giren düzenleme kaybolmasın. */}
        <View style={[s.liste, mesgul && s.kilitli]} aria-disabled={mesgul}>
          {kapaklar.map((k, i) => (
            <KapakSatiri
              key={k.url}
              kapak={k}
              indeks={i}
              onBirak={(kaynak, hedef) => onYaz(tasi(kapaklar, kaynak, hedef))}
              onKaynak={(kaynak) => onYaz(karsilamaGuncelle(kapaklar, k.url, { kaynak }))}
              onAtif={(atif) => onYaz(karsilamaGuncelle(kapaklar, k.url, { atif }))}
              onSil={() => onYaz(kapaklar.filter((x) => x.url !== k.url))}
              onOnizle={() => {
                setOnizlenen(i);
                setOnizleme(true);
              }}
            />
          ))}
        </View>
        {onizleme ? (
          <View style={s.onizlemeKap}>
            <KarsilamaKarti kapak={gosterilen} />
            {kapaklar.length > 1 ? (
              <View style={s.onizlemeEylem}>
                <Text style={s.not}>{ty('anaSayfa.karsilama.onizlemeSira', { i: (onizlenen % kapaklar.length) + 1, n: kapaklar.length })}</Text>
                <Hap kucuk baslik={ty('anaSayfa.karsilama.sonraki')} onPress={() => setOnizlenen((onizlenen + 1) % kapaklar.length)} />
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={s.not}>{ty('anaSayfa.karsilama.not')}</Text>
      </View>
    </View>
  );
}

function KapakSatiri({
  kapak,
  indeks,
  onBirak,
  onKaynak,
  onAtif,
  onSil,
  onOnizle,
}: {
  kapak: KarsilamaKapagi;
  indeks: number;
  onBirak: (kaynak: number, hedef: number) => void;
  onKaynak: (k: FotoKaynagi | undefined) => void;
  onAtif: (a: KarsilamaKapagi['atif']) => void;
  onSil: () => void;
  onOnizle: () => void;
}) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, 'karsilama', indeks, onBirak);
  const atif = kapakAtfiOku(kapak.atif);
  const [atifAcik, setAtifAcik] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const ad = dosyaAdi(kapak.url);
  return (
    <View ref={ref} style={s.kapak}>
      <View style={s.kapakSatir}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.yerTutucu} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Path d={TUTAMAC} />
        </Svg>
        <Pressable accessibilityRole="button" accessibilityLabel={ty('anaSayfa.karsilama.onizleEtiket', { ad })} onPress={onOnizle} style={s.kucukResim}>
          <Foto source={{ uri: kapak.url }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        </Pressable>
        <View style={s.metinler}>
          <Text style={s.kapakAd} numberOfLines={1}>
            {ad}
          </Text>
          {atif ? <KapakAtifSatiri atif={atif} /> : null}
        </View>
        <View style={s.kaynak}>
          <SecimKutusu<FotoKaynagi | ''>
            etiket={ty('sehir.foto.kaynak')}
            deger={kapak.kaynak ?? ''}
            onDegis={(k) => onKaynak(k || undefined)}
            secenekler={[{ deger: '', etiket: ty('sehir.foto.kaynakSec') }, ...KAYNAKLAR.map((k) => ({ deger: k, etiket: ty(`sehir.foto.kaynaklar.${k}`) }))]}
          />
        </View>
        <Hap kucuk baslik={ty(atifAcik ? 'anaSayfa.kapat' : 'anaSayfa.karsilama.atif')} onPress={() => setAtifAcik(!atifAcik)} />
        <Hap kucuk baslik={ty(silOnay ? 'sehir.foto.silOnay' : 'sehir.foto.sil')} onPress={() => (silOnay ? onSil() : setSilOnay(true))} />
      </View>
      {atifAcik ? (
        <AtifDuzenleyici
          atif={atif}
          onKaydet={(a) => {
            onAtif(a);
            setAtifAcik(false);
          }}
        />
      ) : null}
    </View>
  );
}

/** Banner'ın atıf alanlarıyla aynı: yazar, lisans, kaynak sayfası (https). Yazar boşsa atıf kaldırılır. */
function AtifDuzenleyici({ atif, onKaydet }: { atif: ReturnType<typeof kapakAtfiOku>; onKaydet: (a: KarsilamaKapagi['atif']) => void }) {
  const [yazar, setYazar] = useState(atif?.yazar ?? '');
  const [lisans, setLisans] = useState(atif?.lisans ?? '');
  const [kaynak, setKaynak] = useState(atif?.kaynak_url ?? '');
  const [hata, setHata] = useState(false);
  const kaydet = () => {
    const k = kaynak.trim();
    if (k && !/^https:\/\//.test(k)) return setHata(true);
    setHata(false);
    if (!yazar.trim()) return onKaydet(undefined);
    onKaydet({ yazar: yazar.trim(), ...(lisans.trim() ? { lisans: lisans.trim() } : {}), ...(k ? { kaynak_url: k } : {}) });
  };
  return (
    <View style={s.atifKap}>
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.atifYazar')}>
          <MetinKutusu value={yazar} onChangeText={setYazar} maxLength={200} accessibilityLabel={ty('anaSayfa.alan.atifYazar')} />
        </Alan>
        <Alan etiket={ty('anaSayfa.alan.atifLisans')} genislik={150}>
          <MetinKutusu value={lisans} onChangeText={setLisans} maxLength={60} placeholder="CC BY-SA 4.0" accessibilityLabel={ty('anaSayfa.alan.atifLisans')} />
        </Alan>
      </AlanSatiri>
      <Alan etiket={ty('anaSayfa.alan.atifKaynak')}>
        <MetinKutusu
          value={kaynak}
          onChangeText={(x) => {
            setKaynak(x);
            setHata(false);
          }}
          hatali={hata}
          maxLength={500}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://commons.wikimedia.org/wiki/File:…"
          accessibilityLabel={ty('anaSayfa.alan.atifKaynak')}
        />
      </Alan>
      {hata ? (
        <Text accessibilityRole="alert" style={s.hata}>
          {ty('anaSayfa.gorselKaynakHata')}
        </Text>
      ) : null}
      <View style={s.atifEylem}>
        <Hap kucuk baslik={ty('anaSayfa.karsilama.atifKaydet')} onPress={kaydet} />
      </View>
    </View>
  );
}

/** Kanvas `Ana_v9_GeziYok`: kart 358 × 214, köşe 20; koyu geçiş %25'ten %72'ye. */
const KART = { genislik: 358, yukseklik: 214 } as const;
const GECIS = '#0E1430';
/** Kanvastaki görselsiz zemin. */
const ZEMIN = ['#F3D9C4', '#E7B892', '#C98A5E'] as const;

/**
 * KK3: telefon genişliğinde (390) ana sayfanın üstü — logo satırı, "Sıradaki rota neresi?" kartı (başlık, alt satır ve
 * turuncu "Yeni gezi oluştur" görselin üstünde, atıf sağ üstte), arama kutusu. Görsel yoksa kanvastaki zemin; uygulama orada
 * Eskişehir'in kapağını kullanır (#569).
 */
export function KarsilamaKarti({ kapak }: { kapak: KarsilamaKapagi | null }) {
  const atif = kapakAtfiOku(kapak?.atif);
  return (
    <View style={s.telefon} testID="karsilama-onizleme">
      <View style={s.ust}>
        <LogoYazi boyut={36} />
      </View>
      <View style={s.kart}>
        {kapak ? (
          <Foto source={{ uri: kapak.url }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        ) : (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <Defs>
              <LinearGradient id="karsilamaZemin" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ZEMIN[0]} />
                <Stop offset="0.45" stopColor={ZEMIN[0]} />
                <Stop offset="0.45" stopColor={ZEMIN[1]} />
                <Stop offset="1" stopColor={ZEMIN[2]} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#karsilamaZemin)" />
          </Svg>
        )}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <Defs>
            <LinearGradient id="karsilamaGecis" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.25" stopColor={GECIS} stopOpacity={0} />
              <Stop offset="1" stopColor={GECIS} stopOpacity={0.72} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#karsilamaGecis)" />
        </Svg>
        <View style={s.kartMetin} pointerEvents="none">
          <View style={s.kartBasliklar}>
            <Text style={s.kartBaslik}>{ty('anaSayfa.karsilama.kartBaslik')}</Text>
            <Text style={s.kartAlt}>{ty('anaSayfa.karsilama.kartAlt')}</Text>
          </View>
          <View style={s.kartDugme}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={renk.metin} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <Text style={s.kartDugmeMetin}>{ty('anaSayfa.karsilama.kartDugme')}</Text>
          </View>
        </View>
        {atif ? <KapakAtfi atif={atif} stil={s.kartAtif} /> : null}
      </View>
      <View style={s.arama}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={renk.metin} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Circle cx="11" cy="11" r="7" />
          <Path d="M20 20l-4-4" />
        </Svg>
        <Text style={s.aramaMetin}>{ty('anaSayfa.karsilama.arama')}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { borderRadius: 12, borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  kapali: { opacity: 0.55 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  metinler: { flex: 1, minWidth: 0, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  tur: { fontFamily: yazi.kalin, fontSize: 11, color: yRenk.ikincil },
  ozet: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
  govde: { gap: 10, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: yRenk.ayrac, paddingTop: 12 },
  yukle: { height: 64, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pasif: { opacity: 0.5 },
  liste: { gap: 10 },
  kilitli: { opacity: 0.5, pointerEvents: 'none' },
  yukleMetin: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.ikincil },
  kod: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 },
  kapak: { borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac },
  kapakSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10 },
  kucukResim: { width: 72, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: yRenk.yuzey },
  kapakAd: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  kaynak: { width: 150 },
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.hata },
  atifKap: { gap: 10, paddingHorizontal: 10, paddingBottom: 10 },
  atifEylem: { flexDirection: 'row' },
  not: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  onizlemeKap: { gap: 8, alignItems: 'flex-start' },
  onizlemeEylem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Uygulama ekranı (#569, kanvas `Ana_v9_GeziYok`): 390 genişlik, üst güvenli alan 54.
  // 1 px çerçeve içte kalsın diye 392: içerik 390, kart 16 + 358 + 16.
  telefon: { width: 392, paddingTop: 54, paddingBottom: 18, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: renk.ayrac, backgroundColor: renk.zemin },
  ust: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  kart: { marginHorizontal: 16, width: KART.genislik, height: KART.yukseklik, borderRadius: 20, overflow: 'hidden', backgroundColor: ZEMIN[1] },
  kartMetin: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 10 },
  kartBasliklar: { gap: 2 },
  kartBaslik: { fontFamily: yazi.ekstra, fontSize: 24, letterSpacing: -0.24, color: renk.zemin },
  kartAlt: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin },
  kartDugme: { height: 48, borderRadius: 24, backgroundColor: renk.vurgu, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  kartDugmeMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  kartAtif: { position: 'absolute', right: 12, top: 10, bottom: 'auto' },
  arama: { marginTop: 14, marginHorizontal: 16, height: 52, borderRadius: 26, backgroundColor: '#F6F7FA', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 },
  aramaMetin: { fontFamily: yazi.normal, fontSize: 16, color: anaV5.ikincil },
});
