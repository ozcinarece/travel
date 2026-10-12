import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { mdArac, mekanBaglantisi, satirIciEkle, type Secim } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { binlik, blokKimligi, blokTuru, gorselEkle, rehberBloklari, rehberMd, rehberSayaclari, type RehberBlok } from '@/features/yonetim/yer';
import type { HafifYer, Merkez } from '@/features/yerler/api';
import { icerikFotoUrl } from '@/lib/markdown';
import { yazi } from '@/theme';

import { MekanArama } from '../gezi/MekanArama';
import { dosyaSec, useDosyaBirakma } from '../surukle';
import { yRenk } from '../tema';

type Props = {
  md: string | null;
  onDegis: (md: string) => void;
  merkez: Merkez | undefined;
  fotoYukle: (dosya: File) => Promise<string>;
  onHata: (mesaj: string) => void;
  /** Alt şeridin sağı: "Taslak kaydedildi · 17:18". */
  kayitMetni: string | null;
};

type Odak = { id: string; secim: Secim };

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
export function RehberEditoru({ md, onDegis, merkez, fotoYukle, onHata, kayitMetni }: Props) {
  const [bloklar, setBloklar] = useState<RehberBlok[]>(() => sonaParagraf(rehberBloklari(md)));
  const [odak, setOdak] = useState<Odak | null>(null);
  const [mekanAcik, setMekanAcik] = useState(false);
  const son = useRef(bloklar);

  const guncelle = (yeni: RehberBlok[]) => {
    const n = sonaParagraf(yeni);
    son.current = n;
    setBloklar(n);
    onDegis(rehberMd(n));
  };
  const blokGuncelle = (id: string, alanlar: Partial<RehberBlok>) => guncelle(son.current.map((b) => (b.id === id ? { ...b, ...alanlar } : b)));
  const odakBlok = bloklar.find((b) => b.id === odak?.id);
  const metinBlogu = odakBlok && odakBlok.tur !== 'gorsel' ? odakBlok : undefined;

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
  const mekan = (yer: HafifYer) => {
    const hedef = metinBlogu ?? son.current[son.current.length - 1];
    const secim = metinBlogu && odak ? odak.secim : { start: hedef.metin.length, end: hedef.metin.length };
    const sonuc = satirIciEkle(hedef.metin, secim, (secili) => mekanBaglantisi(secili.trim() || yer.ad, yer.place_id));
    blokGuncelle(hedef.id, { metin: sonuc.metin });
    setOdak({ id: hedef.id, secim: sonuc.secim });
    setMekanAcik(false);
  };
  // Paragrafa "## ", "> ", "- " ya da boş satır yazıldıysa odak çıkınca bloklara ayrılır.
  const ayir = (b: RehberBlok) => {
    if (b.tur !== 'paragraf' || !b.metin.trim()) return;
    const parca = rehberBloklari(b.metin);
    if (parca.length === 1 && parca[0].tur === 'paragraf') return;
    const i = son.current.findIndex((x) => x.id === b.id);
    guncelle([...son.current.slice(0, i), ...parca, ...son.current.slice(i + 1)]);
  };

  const sayac = rehberSayaclari(rehberMd(bloklar));

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <Text style={s.etiket}>{ty('yer.rehberEtiket')}</Text>
        <View style={s.arac}>
          <AracDugmesi metin={ty('yer.arac.kalin')} etiket={ty('yer.aracEtiket.kalin')} onPress={() => satirIci('kalin')} />
          <AracDugmesi metin={ty('yer.arac.italik')} etiket={ty('yer.aracEtiket.italik')} onPress={() => satirIci('italik')} italik />
          <AracDugmesi metin={ty('yer.arac.h2')} etiket={ty('yer.aracEtiket.h2')} onPress={() => turDegistir('baslik')} />
          <AracDugmesi metin={ty('yer.arac.alinti')} etiket={ty('yer.aracEtiket.alinti')} onPress={() => turDegistir('alinti')} />
          <AracDugmesi metin={ty('yer.arac.liste')} etiket={ty('yer.aracEtiket.liste')} onPress={() => turDegistir('liste')} />
          <AracDugmesi metin={ty('yer.arac.gorsel')} etiket={ty('yer.aracEtiket.gorsel')} ikon={IKON.kamera} onPress={() => dosyaSec(true, (d) => gorsel(d, null))} />
          <AracDugmesi metin={ty('yer.arac.mekan')} etiket={ty('yer.aracEtiket.mekan')} ikon={IKON.harita} onPress={() => setMekanAcik((a) => !a)} />
          <AracDugmesi metin={ty('yer.arac.ses')} etiket={ty('yer.aracEtiket.ses')} ikon={IKON.yukle} pasif onPress={() => {}} />
        </View>
      </View>
      {mekanAcik ? <MekanArama merkez={merkez} onSec={mekan} /> : null}
      <ScrollView style={s.alan} contentContainerStyle={s.alanIc}>
        {bloklar.map((b, i) =>
          b.tur === 'gorsel' ? (
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
              yerTutucu={i === bloklar.length - 1 && bloklar.length === 1 ? ty('yer.paragraf') : undefined}
              secim={odak?.id === b.id ? odak.secim : undefined}
              onMetin={(metin) => blokGuncelle(b.id, { metin })}
              onSecim={(secim) => setOdak({ id: b.id, secim })}
              onBlur={() => ayir(son.current.find((x) => x.id === b.id) ?? b)}
            />
          ),
        )}
        <View style={s.ses}>
          <View style={s.sesDaire}>
            <Text style={s.sesUcgen}>▶</Text>
          </View>
          <Text style={s.sesMetin}>{ty('yer.ses')}</Text>
        </View>
      </ScrollView>
      <View style={s.serit}>
        <Text style={s.seritMetin}>{ty('yer.sayac', { karakter: binlik(sayac.karakter), dk: sayac.okumaDk })}</Text>
        <Text style={s.seritMetin}>{ty('yer.gorselSayisi', { n: sayac.gorsel })}</Text>
        <Text style={s.seritMetin}>{ty('yer.mekanSayisi', { n: sayac.mekan })}</Text>
        {kayitMetni ? <Text style={[s.seritMetin, s.seritSag]}>{kayitMetni}</Text> : null}
      </View>
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
  yerTutucu,
  secim,
  onMetin,
  onSecim,
  onBlur,
}: {
  blok: RehberBlok;
  yerTutucu?: string;
  secim: Secim | undefined;
  onMetin: (m: string) => void;
  onSecim: (s: Secim) => void;
  onBlur: () => void;
}) {
  const [yukseklik, setYukseklik] = useState<number | undefined>(undefined);
  const tur = blok.tur as keyof typeof METIN_STILI;
  const liste = tur === 'liste';
  const deger = liste ? listeGorunen(blok.metin) : blok.metin;
  const girdi = (
    <TextInput
      multiline
      value={deger}
      onChangeText={(m) => onMetin(liste ? listeHam(m) : m)}
      onSelectionChange={(e) => onSecim(liste ? listeSecimi(deger, e.nativeEvent.selection) : e.nativeEvent.selection)}
      onFocus={() => onSecim(secim ?? { start: blok.metin.length, end: blok.metin.length })}
      onBlur={onBlur}
      onContentSizeChange={(e) => setYukseklik(e.nativeEvent.contentSize.height)}
      placeholder={yerTutucu}
      placeholderTextColor={yRenk.ikincil}
      accessibilityLabel={ty(`yer.blok.${tur}`)}
      scrollEnabled={false}
      style={[METIN_STILI[tur], s.girdi, yukseklik ? { height: yukseklik } : null]}
    />
  );
  return tur === 'alinti' ? <View style={s.alinti}>{girdi}</View> : girdi;
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
} as const;

function AracDugmesi({ metin, etiket, onPress, ikon, italik, pasif }: { metin: string; etiket: string; onPress: () => void; ikon?: string; italik?: boolean; pasif?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiket} accessibilityState={{ disabled: !!pasif }} disabled={pasif} onPress={onPress} style={StyleSheet.flatten([s.aracDugme, pasif && s.pasif])}>
      {ikon ? (
        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={yRenk.metin} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Path d={ikon} />
          {ikon === IKON.kamera ? <Circle cx="12" cy="13.5" r="3.5" /> : null}
        </Svg>
      ) : null}
      <Text style={[s.aracMetin, italik && s.italik]}>{metin}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, gap: 12 },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  arac: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  aracDugme: { height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: yRenk.yuzey, flexDirection: 'row', alignItems: 'center', gap: 5 },
  aracMetin: { fontFamily: yazi.ekstra, fontSize: 11.5, color: yRenk.metin },
  italik: { fontStyle: 'italic' },
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
