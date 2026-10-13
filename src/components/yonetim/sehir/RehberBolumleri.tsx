import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { saatMetni, tasi } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { useOtomatikKayit } from '@/features/yonetim/otomatikKayit';
import { eksikBolum, kartSayisi, mekanBaglari, rehberGovdesi, rehberYazisi, type RehberBolumu } from '@/features/yonetim/sehir';
import { mekanlariYaz, rehberAnahtari, type MekanAdi } from '@/features/yonetim/sehirSorgulari';
import type { HafifYer, Merkez } from '@/features/yerler/api';
import { yazi } from '@/theme';

import { Alan, AlanSatiri, MetinKutusu } from '../Form';
import { Hap } from '../Hap';
import { useSuruklenen } from '../surukle';
import { yRenk } from '../tema';
import { RehberEditoru } from '../yer/RehberEditoru';

const TUTAMAC = 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01';

/**
 * Kanvas RehberEditor22 sol sütun (240 px): "<ŞEHİR> · BÖLÜMLER", satırlar (tutamaç — sürükle = sıra, "01", başlık 13 px
 * 800, "N mekan" = kart olarak bağlı mekan), "+ Bölüm" (eksik tür; dördü varsa yok), Öneriler notu.
 */
export function BolumListesi({
  sehirAdi,
  bolumler,
  seciliId,
  onSec,
  onEkle,
  onSirala,
}: {
  sehirAdi: string;
  bolumler: RehberBolumu[];
  seciliId: string | undefined;
  onSec: (id: string) => void;
  onEkle: () => void;
  onSirala: (yeni: RehberBolumu[]) => void;
}) {
  return (
    <View style={s.liste}>
      <Text style={s.listeBaslik}>{ty('rehber.bolumler', { sehir: sehirAdi.toLocaleUpperCase('tr-TR') })}</Text>
      {bolumler.map((b, i) => (
        <BolumSatiri key={b.id} bolum={b} indeks={i} secili={b.id === seciliId} onSec={() => onSec(b.id)} onBirak={(k, h) => onSirala(tasi(bolumler, k, h))} />
      ))}
      {eksikBolum(bolumler) ? (
        <View style={s.ekle}>
          <Hap kucuk baslik={ty('rehber.yeniBolum')} onPress={onEkle} />
        </View>
      ) : null}
      <Text style={s.not}>
        {ty('rehber.notOnce')}
        <Text style={s.notKalin}>{ty('rehber.notOneriler')}</Text>
        {ty('rehber.notSonra')}
      </Text>
    </View>
  );
}

function BolumSatiri({ bolum, indeks, secili, onSec, onBirak }: { bolum: RehberBolumu; indeks: number; secili: boolean; onSec: () => void; onBirak: (k: number, h: number) => void }) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, 'rehber-bolum', indeks, onBirak);
  const kart = kartSayisi(bolum.yazi_md);
  return (
    <Pressable ref={ref} accessibilityRole="button" accessibilityState={{ selected: secili }} onPress={onSec} style={StyleSheet.flatten([s.satir, secili && s.satirSecili])}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.yerTutucu} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d={TUTAMAC} />
      </Svg>
      <Text style={s.no}>{String(indeks + 1).padStart(2, '0')}</Text>
      <Text style={s.ad} numberOfLines={1}>
        {bolum.baslik}
      </Text>
      <Text style={s.sayi}>{kart ? ty('rehber.mekanSayisi', { n: kart }) : ''}</Text>
    </Pressable>
  );
}

type BolumTaslagi = { baslik: string; ozet: string | null; yazi_md: string | null };

/**
 * Kanvas RehberEditor22 orta: BÖLÜM BAŞLIĞI + KISA ÖZET (içindekiler satırı), yazı editörü (başlık yazının üstünde; araç
 * çubuğu Mekan ile). Yazı `# Başlık` + gövde olarak kaydedilir (uygulama ilk başlığı atar); kayıtta yazıdaki mekanlar
 * `icerik_mekanlari`na yazılır, yerlerde olmayanlar taslak yer olarak açılır.
 */
export function BolumEditoru({
  bolum,
  merkez,
  fotoYukle,
  onHata,
  onTaslak,
}: {
  bolum: RehberBolumu;
  merkez: Merkez;
  fotoYukle: (dosya: File) => Promise<string>;
  onHata: (m: string) => void;
  onTaslak: (t: BolumTaslagi) => void;
}) {
  const bilinen = useRef<Record<string, MekanAdi>>({});
  const { taslak, degistir, durum } = useOtomatikKayit<BolumTaslagi>({
    tablo: 'sehir_rehberi',
    id: bolum.id,
    ilk: { baslik: bolum.baslik, ozet: bolum.ozet, yazi_md: bolum.yazi_md },
    yenilenecek: [rehberAnahtari(bolum.sehir_id)],
    onKaydedildi: async (t, fark) => {
      if (fark.yazi_md !== undefined) await mekanlariYaz('rehber', bolum.id, mekanBaglari(t.yazi_md), bilinen.current);
    },
  });
  const [govde] = useState(() => rehberGovdesi(bolum.yazi_md));
  // En güncel taslağa uygulanır (başlık ve gövde aynı `yazi_md`de); önizleme de aynı taslağı görür.
  const guncelle = (f: (t: BolumTaslagi) => Partial<BolumTaslagi>) =>
    degistir((t) => {
      const alanlar = f(t);
      onTaslak({ ...t, ...alanlar });
      return alanlar;
    });
  const mekanSecildi = (y: HafifYer) => {
    bilinen.current[y.place_id] = { ad: y.ad, kategori: y.primary_type, lat: y.lat, lng: y.lng };
  };
  const kayitMetni = durum.kaydediliyor ? ty('gezi.kaydediliyor') : durum.hata ? ty('gezi.kayitHata') : durum.kaydedildi ? ty('rehber.kaydedildi', { saat: saatMetni(durum.kaydedildi) }) : null;

  return (
    <View style={s.editor}>
      <AlanSatiri>
        <Alan etiket={ty('rehber.alan.baslik')}>
          <MetinKutusu
            value={taslak.baslik}
            onChangeText={(baslik) => guncelle((t) => ({ baslik, yazi_md: rehberYazisi(baslik || ' ', rehberGovdesi(t.yazi_md)) }))}
            maxLength={120}
            accessibilityLabel={ty('rehber.alan.baslik')}
          />
        </Alan>
        <Alan etiket={ty('rehber.alan.ozet')}>
          <MetinKutusu value={taslak.ozet ?? ''} onChangeText={(ozet) => guncelle(() => ({ ozet: ozet || null }))} maxLength={200} accessibilityLabel={ty('rehber.alan.ozet')} />
        </Alan>
      </AlanSatiri>
      <RehberEditoru
        md={govde}
        onDegis={(g) => guncelle((t) => ({ yazi_md: rehberYazisi(t.baslik, g) }))}
        merkez={merkez}
        fotoYukle={fotoYukle}
        onHata={onHata}
        kayitMetni={kayitMetni}
        sehirRehberi={{ baslik: taslak.baslik }}
        onMekanSecildi={mekanSecildi}
      />
    </View>
  );
}

const s = StyleSheet.create({
  liste: { width: 240, flexShrink: 0, borderRightWidth: 1, borderRightColor: yRenk.ayrac, backgroundColor: yRenk.zemin, paddingVertical: 14, paddingHorizontal: 10, gap: 2 },
  listeBaslik: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil, paddingHorizontal: 8, paddingBottom: 8 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10 },
  satirSecili: { backgroundColor: yRenk.yuzey },
  no: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  ad: { flex: 1, minWidth: 0, fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  sayi: { fontFamily: yazi.kalin, fontSize: 11, color: yRenk.ikincil },
  ekle: { marginTop: 6, flexDirection: 'row' },
  not: { marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: yRenk.yuzey, fontFamily: yazi.yari, fontSize: 11, lineHeight: 16, color: yRenk.ikincil },
  notKalin: { fontFamily: yazi.ekstra, color: yRenk.metin },
  editor: { flex: 1, gap: 12 },
});
