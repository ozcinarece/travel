import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { mdArac, mekanBaglantisi, satirIciEkle, tasi, type Secim } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { kaynakIzleri } from '@/features/yonetim/sehir';
import { binlik, blokKimligi, blokTuru, gorselEkle, kartEkle, rehberBloklari, rehberMd, rehberSayaclari, type RehberBlok } from '@/features/yonetim/yer';
import { useHafifYerler, type HafifYer, type Merkez } from '@/features/yerler/api';
import { kategoriEtiketi } from '@/lib/kategori';
import { icerikFotoUrl, satirParcalari } from '@/lib/markdown';
import { kategoriPini } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { dosyaSec, useBirakmaHedefi, useDosyaBirakma, useSuruklenen } from '../surukle';
import { yRenk } from '../tema';
import { MekanSecici, type MekanBicimi } from './MekanSecici';

type Props = {
  md: string | null;
  onDegis: (md: string) => void;
  merkez: Merkez | undefined;
  fotoYukle: (dosya: File) => Promise<string>;
  onHata: (mesaj: string) => void;
  /** Alt şeridin sağı: "Taslak kaydedildi · 17:18". */
  kayitMetni: string | null;
  /** #111 şehir rehberi (kanvas RehberEditor22): 30 px araç düğmeleri, ses yeri yok, yazının üstünde bölüm başlığı, kart sayacı. */
  sehirRehberi?: { baslik: string };
  /** Seçilen mekan (kayıtta taslak yer açmak için ad / kategori / konum). */
  onMekanSecildi?: (yer: HafifYer) => void;
};

type Odak = { id: string; secim: Secim };
type MekanAraci = { bicim: MekanBicimi; degistir?: string } | null;

/** Son blok hep boş paragraf: görselden / başlıktan sonra yazmaya devam edilebilsin (boş blok markdown'a yazılmaz). */
function sonaParagraf(bloklar: RehberBlok[]): RehberBlok[] {
  const son = bloklar[bloklar.length - 1];
  return son && son.tur === 'paragraf' && !son.metin.trim() ? bloklar : [...bloklar, { id: blokKimligi(), tur: 'paragraf', metin: '' }];
}

/** Liste bloğu ekranda "• " önekiyle; seçim ham metne çevrilir (satır başına 2 karakter). */
const listeGorunen = (metin: string) => metin.split('\n').map((s) => `• ${s}`).join('\n');
const listeHam = (gorunen: string) => gorunen.split('\n').map((s) => s.replace(/^•\s?/, '')).join('\n');
function listeSecimi(gorunen: string, secim: Secim): Secim {
  const cevir = (p: number) => Math.max(0, p - 2 * (gorunen.slice(0, p).split('\n').length));
  return { start: cevir(secim.start), end: cevir(secim.end) };
}

/**
 * KK3 (kanvas ekran 4 "REHBER · markdown"): büyük yazı alanı blok görünümünde — başlık, paragraf, görsel satırı (170 × 110)
 * + "Görsel ekle" (sürükle ya da seç) + altyazı, alıntı kutusu, liste; araç çubuğu B · I · H2 · alıntı · Liste · Görsel ·
 * Mekan · Ses (yakında); sesli anlatım yeri; alt şeritte karakter, okuma süresi, görsel ve mekan sayısı. Saklanan biçim
 * gezi yazısıyla aynı markdown (`yerler.rehber_md`). Boş satır yeni paragraf; "## ", "> ", "- " ile başlayan paragraf
 * odak çıkınca başlık / alıntı / listeye dönüşür.
 */
export function RehberEditoru({ md, onDegis, merkez, fotoYukle, onHata, kayitMetni, sehirRehberi, onMekanSecildi }: Props) {
  const [bloklar, setBloklar] = useState<RehberBlok[]>(() => sonaParagraf(rehberBloklari(md)));
  const [odak, setOdak] = useState<Odak | null>(null);
  const [mekanAraci, setMekanAraci] = useState<MekanAraci>(null);
  const son = useRef(bloklar);
  const kartIdleri = [...new Set(bloklar.filter((b) => b.tur === 'mekan').map((b) => b.metin))];
  const kartYerleri = useHafifYerler(kartIdleri);

  const guncelle = (yeni: RehberBlok[]) => {
    const n = sonaParagraf(yeni);
    son.current = n;
    setBloklar(n);
    onDegis(rehberMd(n));
  };
  const blokGuncelle = (id: string, alanlar: Partial<RehberBlok>) => guncelle(son.current.map((b) => (b.id === id ? { ...b, ...alanlar } : b)));
  const odakBlok = bloklar.find((b) => b.id === odak?.id);
  const metinBlogu = odakBlok && odakBlok.tur !== 'gorsel' && odakBlok.tur !== 'mekan' ? odakBlok : undefined;
  const metinSecili = !!(metinBlogu && odak && odak.secim.end > odak.secim.start);

  const satirIci = (arac: 'kalin' | 'italik') => {
    if (!metinBlogu || !odak) return;
    const sonuc = mdArac(metinBlogu.metin, odak.secim, arac);
    blokGuncelle(metinBlogu.id, { metin: sonuc.metin });
    setOdak({ id: metinBlogu.id, secim: sonuc.secim });
  };
  const turDegistir = (tur: 'baslik' | 'alinti' | 'liste') => {
    const hedef = metinBlogu ?? son.current[son.current.length - 1];
    guncelle(son.current.map((b) => (b.id === hedef.id ? blokTuru(b, tur) : b)));
  };
  const gorsel = (dosyalar: File[], blokId: string | null) => {
    void (async () => {
      for (const dosya of dosyalar) {
        try {
          const yol = await fotoYukle(dosya);
          guncelle(gorselEkle(son.current, blokId ?? odak?.id ?? null, `foto:${yol}`));
        } catch (e) {
          onHata((e as Error).message);
        }
      }
    })();
  };
  // Kanvas: satır içi = seçili metin bağlantı olur (seçim yoksa mekanın adı eklenir); kart = imlecin paragrafının altına.
  const mekan = (yer: HafifYer, bicim: MekanBicimi) => {
    onMekanSecildi?.(yer);
    const degisecek = mekanAraci?.degistir;
    setMekanAraci(null);
    if (degisecek) {
      blokGuncelle(degisecek, { metin: yer.place_id });
      return;
    }
    if (bicim === 'kart') {
      guncelle(kartEkle(son.current, odak?.id ?? null, yer.place_id));
      return;
    }
    const hedef = metinBlogu ?? [...son.current].reverse().find((b) => b.tur === 'paragraf') ?? son.current[son.current.length - 1];
    const secim = metinBlogu && odak ? odak.secim : { start: hedef.metin.length, end: hedef.metin.length };
    const sonuc = satirIciEkle(hedef.metin, secim, (secili) => mekanBaglantisi(secili.trim() || yer.ad, yer.place_id));
    blokGuncelle(hedef.id, { metin: sonuc.metin });
    setOdak({ id: hedef.id, secim: sonuc.secim });
  };
  const blokTasi = (kaynak: number, hedef: number) => guncelle(tasi(son.current, kaynak, hedef));
  // Paragrafa "## ", "> ", "- " ya da boş satır yazıldıysa odak çıkınca bloklara ayrılır.
  const ayir = (b: RehberBlok) => {
    if (b.tur !== 'paragraf' || !b.metin.trim()) return;
    const parca = rehberBloklari(b.metin);
    if (parca.length === 1 && parca[0].tur === 'paragraf') return;
    const i = son.current.findIndex((x) => x.id === b.id);
    guncelle([...son.current.slice(0, i), ...parca, ...son.current.slice(i + 1)]);
  };

  const mdSimdi = rehberMd(bloklar);
  const sayac = rehberSayaclari(mdSimdi);
  const izler = sehirRehberi ? kaynakIzleri(mdSimdi) : [];
  const buyuk = !!sehirRehberi;

  const araclar = (
    <View style={s.arac}>
      <AracDugmesi buyuk={buyuk} metin={ty('yer.arac.kalin')} etiket={ty('yer.aracEtiket.kalin')} onPress={() => satirIci('kalin')} />
      <AracDugmesi buyuk={buyuk} metin={ty('yer.arac.italik')} etiket={ty('yer.aracEtiket.italik')} onPress={() => satirIci('italik')} italik />
      <AracDugmesi buyuk={buyuk} metin={ty('yer.arac.h2')} etiket={ty('yer.aracEtiket.h2')} onPress={() => turDegistir('baslik')} />
      <AracDugmesi buyuk={buyuk} metin={ty('yer.arac.alinti')} etiket={ty('yer.aracEtiket.alinti')} onPress={() => turDegistir('alinti')} />
      <AracDugmesi buyuk={buyuk} metin={ty('yer.arac.liste')} etiket={ty('yer.aracEtiket.liste')} onPress={() => turDegistir('liste')} />
      <AracDugmesi buyuk={buyuk} metin={ty('yer.arac.gorsel')} etiket={ty('yer.aracEtiket.gorsel')} ikon={IKON.kamera} onPress={() => dosyaSec(true, (d) => gorsel(d, null))} />
      <AracDugmesi
        buyuk={buyuk}
        secili={!!mekanAraci}
        metin={ty('yer.arac.mekan')}
        etiket={ty('yer.aracEtiket.mekan')}
        ikon={IKON.harita}
        onPress={() => setMekanAraci((a) => (a ? null : { bicim: metinSecili ? 'satir' : 'kart' }))}
      />
      {sehirRehberi ? null : <AracDugmesi metin={ty('yer.arac.ses')} etiket={ty('yer.aracEtiket.ses')} ikon={IKON.yukle} pasif onPress={() => {}} />}
    </View>
  );

  return (
    <View style={s.kap}>
      {sehirRehberi ? (
        araclar
      ) : (
        <View style={s.ust}>
          <Text style={s.etiket}>{ty('yer.rehberEtiket')}</Text>
          {araclar}
        </View>
      )}
      {mekanAraci ? (
        <View style={s.acilir}>
          <MekanSecici
            key={mekanAraci.degistir ?? mekanAraci.bicim}
            merkez={merkez}
            varsayilan={mekanAraci.bicim}
            yalnizKart={!!mekanAraci.degistir}
            onEkle={mekan}
            onVazgec={() => setMekanAraci(null)}
          />
        </View>
      ) : null}
      <ScrollView style={s.alan} contentContainerStyle={s.alanIc}>
        {sehirRehberi ? <Text style={s.ustBaslik}>{sehirRehberi.baslik}</Text> : null}
        {bloklar.map((b, i) =>
          b.tur === 'mekan' ? (
            <KartBlogu
              key={b.id}
              blok={b}
              indeks={i}
              yer={kartYerleri.data?.[b.metin]}
              onBirak={blokTasi}
              onDegistir={() => setMekanAraci({ bicim: 'kart', degistir: b.id })}
              onKaldir={() => guncelle(son.current.filter((x) => x.id !== b.id))}
            />
          ) : b.tur === 'gorsel' ? (
            <GorselBlogu
              key={b.id}
              blok={b}
              onEkle={(d) => gorsel(d, b.id)}
              onAltyazi={(metin) => blokGuncelle(b.id, { metin })}
              onKaldir={() => guncelle(son.current.filter((x) => x.id !== b.id))}
            />
          ) : (
            <MetinBlogu
              key={b.id}
              blok={b}
              indeks={i}
              onKartBirak={blokTasi}
              yerTutucu={i === bloklar.length - 1 && bloklar.length === 1 ? ty('yer.paragraf') : undefined}
              secim={odak?.id === b.id ? odak.secim : undefined}
              onMetin={(metin) => blokGuncelle(b.id, { metin })}
              onSecim={(secim) => setOdak({ id: b.id, secim })}
              onBlur={() => ayir(son.current.find((x) => x.id === b.id) ?? b)}
            />
          ),
        )}
        {izler.length ? (
          <Text style={s.kaynak}>
            {ty('rehber.kaynak')}
            {izler.map((iz, j) => (
              <Text key={j}>
                {j ? ' · ' : ''}
                <Text style={s.kaynakIz}>{iz}</Text>
              </Text>
            ))}
          </Text>
        ) : null}
        {sehirRehberi ? null : (
          <View style={s.ses}>
            <View style={s.sesDaire}>
              <Text style={s.sesUcgen}>▶</Text>
            </View>
            <Text style={s.sesMetin}>{ty('yer.ses')}</Text>
          </View>
        )}
      </ScrollView>
      {sehirRehberi ? (
        <View style={s.serit}>
          <Text style={s.seritMetin}>{ty('rehber.sayac', { kart: sayac.kart, satir: sayac.mekan })}</Text>
          <Text style={s.seritMetin}>{ty('rehber.okuma', { dk: sayac.okumaDk })}</Text>
          {kayitMetni ? <Text style={[s.seritMetin, s.seritSag]}>{kayitMetni}</Text> : null}
        </View>
      ) : (
        <View style={s.serit}>
          <Text style={s.seritMetin}>{ty('yer.sayac', { karakter: binlik(sayac.karakter), dk: sayac.okumaDk })}</Text>
          <Text style={s.seritMetin}>{ty('yer.gorselSayisi', { n: sayac.gorsel })}</Text>
          <Text style={s.seritMetin}>{ty('yer.mekanSayisi', { n: sayac.mekan + sayac.kart })}</Text>
          {kayitMetni ? <Text style={[s.seritMetin, s.seritSag]}>{kayitMetni}</Text> : null}
        </View>
      )}
    </View>
  );
}

const METIN_STILI: Record<'baslik' | 'paragraf' | 'alinti' | 'liste', TextStyle> = {
  baslik: { fontFamily: yazi.ekstra, fontSize: 15, letterSpacing: -0.15, lineHeight: 20, color: yRenk.metin, paddingTop: 4 },
  paragraf: { fontFamily: yazi.normal, fontSize: 13.5, lineHeight: 21.6, color: '#2a2a2a' },
  alinti: { fontFamily: yazi.kalin, fontSize: 13, lineHeight: 19, color: yRenk.metin },
  liste: { fontFamily: yazi.normal, fontSize: 13.5, lineHeight: 21.6, color: '#2a2a2a' },
};

function MetinBlogu({
  blok,
  indeks,
  onKartBirak,
  yerTutucu,
  secim,
  onMetin,
  onSecim,
  onBlur,
}: {
  blok: RehberBlok;
  indeks: number;
  onKartBirak: (kaynak: number, hedef: number) => void;
  yerTutucu?: string;
  secim: Secim | undefined;
  onMetin: (m: string) => void;
  onSecim: (s: Secim) => void;
  onBlur: () => void;
}) {
  const [yukseklik, setYukseklik] = useState<number | undefined>(undefined);
  const [duzenle, setDuzenle] = useState(false);
  const hedef = useRef<View>(null);
  useBirakmaHedefi(hedef, 'rehber-kart', indeks, onKartBirak);
  const tur = blok.tur as keyof typeof METIN_STILI;
  // Kanvas: satır içi mekan bağlantısı turuncu alt çizgili vurgu — odak dışındaki paragraf biçimli çizilir, dokununca düzenlenir.
  if (tur === 'paragraf' && !duzenle && /\]\(mekan:/.test(blok.metin)) {
    return (
      <View ref={hedef}>
        <Text accessibilityRole="button" accessibilityLabel={ty('yer.blok.paragraf')} onPress={() => setDuzenle(true)} style={METIN_STILI.paragraf}>
          {satirParcalari(blok.metin).map((p, j) => (
            <Text key={j} style={[p.kalin && s.kalin, p.italik && s.italik, p.place_id ? s.bag : null]}>
              {p.metin}
            </Text>
          ))}
        </Text>
      </View>
    );
  }
  const liste = tur === 'liste';
  const deger = liste ? listeGorunen(blok.metin) : blok.metin;
  const girdi = (
    <TextInput
      multiline
      value={deger}
      onChangeText={(m) => onMetin(liste ? listeHam(m) : m)}
      onSelectionChange={(e) => onSecim(liste ? listeSecimi(deger, e.nativeEvent.selection) : e.nativeEvent.selection)}
      autoFocus={duzenle}
      onFocus={() => onSecim(secim ?? { start: blok.metin.length, end: blok.metin.length })}
      onBlur={() => {
        setDuzenle(false);
        onBlur();
      }}
      onContentSizeChange={(e) => setYukseklik(e.nativeEvent.contentSize.height)}
      placeholder={yerTutucu}
      placeholderTextColor={yRenk.ikincil}
      accessibilityLabel={ty(`yer.blok.${tur}`)}
      scrollEnabled={false}
      style={[METIN_STILI[tur], s.girdi, yukseklik ? { height: yukseklik } : null]}
    />
  );
  return (
    <View ref={hedef} style={tur === 'alinti' ? s.alinti : null}>
      {girdi}
    </View>
  );
}

/**
 * Kanvas mini kart: tutamaç (sürükle = taşı), 34 px kategori karesi, ad (canlı Google; saklanmaz), "MEKAN KARTI · kategori ·
 * place_id ✓", Değiştir, ×. 1,5 px siyah çerçeve, 10 yarıçap.
 */
function KartBlogu({
  blok,
  indeks,
  yer,
  onBirak,
  onDegistir,
  onKaldir,
}: {
  blok: RehberBlok;
  indeks: number;
  yer: HafifYer | undefined;
  onBirak: (kaynak: number, hedef: number) => void;
  onDegistir: () => void;
  onKaldir: () => void;
}) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, 'rehber-kart', indeks, onBirak);
  const ad = yer?.ad ?? blok.metin;
  return (
    <View ref={ref} style={s.kart}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#c8c8c4" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d={IKON.tutamac} />
      </Svg>
      <View style={[s.kartKare, { backgroundColor: kategoriPini(yer?.primary_type).kategoriRenk }]} />
      <View style={s.kartMetin}>
        <Text style={s.kartAd} numberOfLines={1}>
          {ad}
        </Text>
        <Text style={s.kartAlt} numberOfLines={1}>
          {ty('rehber.kartAlt', { kategori: kategoriEtiketi(yer?.primary_type) })}
        </Text>
      </View>
      <Text accessibilityRole="button" onPress={onDegistir} style={s.kartEylem}>
        {ty('rehber.degistir')}
      </Text>
      <Text accessibilityRole="button" accessibilityLabel={ty('rehber.kaldir', { ad })} onPress={onKaldir} style={s.kartCarpi}>
        ×
      </Text>
    </View>
  );
}

function GorselBlogu({ blok, onEkle, onAltyazi, onKaldir }: { blok: RehberBlok; onEkle: (d: File[]) => void; onAltyazi: (m: string) => void; onKaldir: () => void }) {
  const birak = useRef<View>(null);
  useDosyaBirakma(birak, onEkle);
  const [duzenle, setDuzenle] = useState(false);
  const hedefler = blok.hedefler ?? [];
  return (
    <View style={s.gorselKap}>
      <View style={s.gorselSatir}>
        {hedefler.map((h) => (
          <Image key={h} source={{ uri: h.startsWith('foto:') ? icerikFotoUrl(h.slice(5)) : h }} style={s.gorsel} contentFit="cover" accessibilityLabel={blok.metin} />
        ))}
        {hedefler.length < 2 ? (
          <Pressable ref={birak} accessibilityRole="button" accessibilityLabel={ty('yer.gorselEkle')} onPress={() => dosyaSec(true, onEkle)} style={s.ekleKutu}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={yRenk.ikincil} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <Path d={IKON.yukle} />
            </Svg>
            <Text style={s.ekleMetin}>{ty('yer.gorselEkle')}</Text>
            <Text style={s.ekleAlt}>{ty('yer.gorselEkleAlt')}</Text>
          </Pressable>
        ) : null}
      </View>
      {duzenle ? (
        <TextInput
          autoFocus
          value={blok.metin}
          onChangeText={onAltyazi}
          onBlur={() => setDuzenle(false)}
          onSubmitEditing={() => setDuzenle(false)}
          placeholder={ty('yer.alan.altyazi')}
          accessibilityLabel={ty('yer.alan.altyazi')}
          style={[s.altyazi, s.altyaziGirdi]}
        />
      ) : (
        <Text style={s.altyazi}>
          {blok.metin ? ty('yer.altyazi', { metin: blok.metin }) : ty('yer.altyaziYok')}
          {' · '}
          <Text accessibilityRole="button" onPress={() => setDuzenle(true)} style={s.altyaziEylem}>
            {ty('yer.duzenle')}
          </Text>
          {' · '}
          <Text accessibilityRole="button" onPress={onKaldir} style={s.altyaziEylem}>
            {ty('yer.kaldir')}
          </Text>
        </Text>
      )}
    </View>
  );
}

// Kanvas araç çubuğu ikonları (13 px, 2,2 çizgi): Görsel = kamera, Mekan = harita, Ses = yükle.
const IKON = {
  kamera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4V8z',
  harita: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  yukle: 'M12 16V4M6 10l6-6 6 6M4 20h16',
  tutamac: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
} as const;

// Kanvas araç düğmesi: yer rehberi 28 px / 11,5 px; şehir rehberi (RehberEditor22) 30 px / 12 px, açık araç siyah.
function AracDugmesi({
  metin,
  etiket,
  onPress,
  ikon,
  italik,
  pasif,
  buyuk,
  secili,
}: {
  metin: string;
  etiket: string;
  onPress: () => void;
  ikon?: string;
  italik?: boolean;
  pasif?: boolean;
  buyuk?: boolean;
  secili?: boolean;
}) {
  const renk = secili ? yRenk.zemin : yRenk.metin;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiket}
      accessibilityState={{ disabled: !!pasif, expanded: secili }}
      disabled={pasif}
      onPress={onPress}
      style={StyleSheet.flatten([s.aracDugme, buyuk && s.aracBuyuk, secili && s.aracSecili, pasif && s.pasif])}>
      {ikon ? (
        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={renk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Path d={ikon} />
          {ikon === IKON.kamera ? <Circle cx="12" cy="13.5" r="3.5" /> : null}
        </Svg>
      ) : null}
      <Text style={[s.aracMetin, buyuk && s.aracMetinBuyuk, { color: renk }, italik && s.italik]}>{metin}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, gap: 12, position: 'relative' },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  arac: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  aracDugme: { height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: yRenk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 5 },
  aracMetin: { fontFamily: yazi.ekstra, fontSize: 11.5, color: yRenk.metin },
  aracBuyuk: { height: 30 },
  aracMetinBuyuk: { fontSize: 12 },
  aracSecili: { backgroundColor: yRenk.metin },
  italik: { fontStyle: 'italic' },
  kalin: { fontFamily: yazi.kalin },
  bag: { fontFamily: yazi.kalin, backgroundColor: '#fff1e8', borderBottomWidth: 2, borderBottomColor: '#ff5a1f' },
  acilir: { position: 'absolute', top: 38, left: 0, right: 0, zIndex: 10, alignItems: 'center' },
  ustBaslik: { fontFamily: yazi.ekstra, fontSize: 16, color: yRenk.metin },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, marginVertical: 2, borderRadius: 10, borderWidth: 1.5, borderColor: yRenk.metin, backgroundColor: yRenk.zemin },
  kartKare: { width: 34, height: 34, borderRadius: 8 },
  kartMetin: { flex: 1, minWidth: 0 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
  kartAlt: { fontFamily: yazi.yari, fontSize: 10.5, color: yRenk.ikincil },
  kartEylem: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  kartCarpi: { fontFamily: yazi.normal, fontSize: 14, color: yRenk.ikincil, paddingHorizontal: 4 },
  kaynak: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: yRenk.yuzey, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: yRenk.ikincil },
  kaynakIz: { color: yRenk.metin },
  pasif: { opacity: 0.5 },
  alan: { flex: 1, minHeight: 420, borderRadius: 12, borderWidth: 1, borderColor: yRenk.cerceve },
  alanIc: { paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  girdi: { padding: 0 },
  alinti: { paddingVertical: 10, paddingHorizontal: 14, borderLeftWidth: 3, borderLeftColor: yRenk.metin, backgroundColor: yRenk.yuzey, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  gorselKap: { gap: 10 },
  gorselSatir: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  gorsel: { width: 170, height: 110, borderRadius: 10, backgroundColor: yRenk.yuzey },
  ekleKutu: { flex: 1, minHeight: 110, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve, alignItems: 'center', justifyContent: 'center', gap: 4 },
  ekleMetin: { fontFamily: yazi.kalin, fontSize: 11.5, color: yRenk.ikincil },
  ekleAlt: { fontFamily: yazi.yari, fontSize: 10.5, color: yRenk.ikincil },
  altyazi: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  altyaziGirdi: { borderBottomWidth: 1, borderBottomColor: yRenk.cerceve, paddingVertical: 2 },
  altyaziEylem: { color: yRenk.metin },
  ses: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve },
  sesDaire: { width: 30, height: 30, borderRadius: 15, backgroundColor: yRenk.yuzey, alignItems: 'center', justifyContent: 'center' },
  sesUcgen: { fontSize: 11, color: yRenk.ikincil },
  sesMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 12, color: yRenk.ikincil },
  serit: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  seritMetin: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  seritSag: { marginLeft: 'auto' },
});
