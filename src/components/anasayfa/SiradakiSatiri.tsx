// #569 KK4 (kanvas `Ana_v9_GeziSirasi`): gezi sırasındaki kartın alt satırı — "Sıradaki: durak · saat". Kaynak Gezi
// sayfasının "Şimdi" verisiyle aynı hesap (`simdiHedefi(odakKarti(…), sonrakiKart(…))`, bugünün canlı programı, varış saati).
// Gezi sayfası açılışındaki gibi `ag: false`: yürüyüş matrisi ve rota bacakları istenmez (önbellekte varsa o, yoksa kuş uçuşu
// kestirimi); mekan adı bizim içeriğimizden ya da oturum önbelleğinden, yoksa kategori. Google'a istek yok. Konum izlenmez
// (ana sayfada konum izni istenmez); Gezi sayfasının konumsuz hali.
import { useEffect, useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { siradakiMetni } from '@/features/anasayfa/v9';
import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { simdiHedefi } from '@/features/gezi/seyahatV7';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import type { Konaklama } from '@/features/konaklama/plan';
import { useKonaklamalar } from '@/features/konaklama/sorgular';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { kartListesi, odakKarti, sonrakiKart } from '@/features/program/durakKarti';
import { gunDuraklari, useGunProgrami, useSimdi } from '@/features/program/useProgram';
import { useProgramVerisi } from '@/features/program/useProgramVerisi';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import type { HafifYer } from '@/features/yerler/api';
import { useCevrimdisi } from '@/lib/baglanti';
import type { Durak, Gun, Mekan, Seyahat } from '@/lib/tipler';
import { kacinciGun } from '@/lib/zaman';
import { dakikaSaat } from '@/schedule/tempo';

/** `onMetin`: gösterilen metin (yoksa null) — kartın ekran okuyucu etiketi için. */
type Props = { seyahatId: string; stil?: StyleProp<TextStyle>; onMetin?: (metin: string | null) => void };

/** Veri gelene kadar (ya da sıradaki durak yoksa) satır çizilmez. */
export function SiradakiSatiri({ seyahatId, stil, onMetin }: Props) {
  const seyahat = useSeyahat(seyahatId);
  const gunler = useGunler(seyahatId);
  const duraklar = useDuraklar(seyahatId);
  const mekanlar = useMekanlar(seyahatId);
  const konaklamalar = useKonaklamalar(seyahatId);
  const cevrimdisi = useCevrimdisi();
  const konaklamaVerisi = konaklamalar.data ?? (cevrimdisi ? BOS_KONAKLAMA : undefined);
  const hazir = !!(seyahat.data && gunler.data && duraklar.data && mekanlar.data && konaklamaVerisi);
  useEffect(() => {
    if (!hazir) onMetin?.(null);
  }, [hazir, onMetin]);
  if (!seyahat.data || !gunler.data || !duraklar.data || !mekanlar.data || !konaklamaVerisi) return null;
  return <Hesap seyahat={seyahat.data} gunler={gunler.data} duraklar={duraklar.data} mekanlar={mekanlar.data} konaklamalar={konaklamaVerisi} cevrimdisi={cevrimdisi} stil={stil} onMetin={onMetin} />;
}

const BOS_KONAKLAMA: Konaklama[] = [];

function Hesap({
  seyahat,
  gunler,
  duraklar,
  mekanlar,
  konaklamalar,
  cevrimdisi,
  stil,
  onMetin,
}: {
  seyahat: Seyahat;
  gunler: Gun[];
  duraklar: Durak[];
  mekanlar: Mekan[];
  konaklamalar: Konaklama[];
  cevrimdisi: boolean;
  stil?: StyleProp<TextStyle>;
  onMetin?: (metin: string | null) => void;
}) {
  const an = useSimdi(true);
  const bugunIndex = kacinciGun(seyahat, an);
  const bugunGun = bugunIndex ? gunler.find((g) => g.index === bugunIndex) : undefined;
  const verisi = useProgramVerisi({ seyahat, gunler, duraklar, mekanlar, seciliGun: bugunGun, konaklamalar, ag: false });
  const bilinen = useBilinenMekanlar(
    useMemo(() => mekanlar.map((m) => m.place_id), [mekanlar]),
    cevrimdisi,
  );
  const mekanIle = useMemo(() => new Map(mekanlar.map((m) => [m.id, m])), [mekanlar]);
  const bugunDuraklari = useMemo(() => (bugunGun ? gunDuraklari(bugunGun, duraklar) : []), [bugunGun, duraklar]);
  const prog = useGunProgrami({ seyahat, gun: bugunGun, duraklar, mekanlar, yuruyus: verisi.yuruyus, an, uclar: verisi.seciliUclar });
  const kartlar = useMemo(() => {
    const adlar: Record<string, HafifYer> = {};
    for (const m of mekanlar) {
      const ad = bilinen.ad(m);
      if (ad) adlar[m.place_id] = { place_id: m.place_id, ad, lat: m.lat ?? NaN, lng: m.lng ?? NaN, primary_type: m.primary_type, tz: null, puan: null, puan_sayisi: null, acik: null, ulke_kodu: null };
    }
    return kartListesi({ gunDurak: bugunDuraklari, mekanIle, adlar, satirlar: prog?.canli.satirlar ?? [] }).map((k) => (k.ad === '…' ? { ...k, ad: k.kategori } : k));
  }, [mekanlar, bilinen, bugunDuraklari, mekanIle, prog]);
  const odak = odakKarti(kartlar, true);
  const hedef = simdiHedefi(odak, odak ? sonrakiKart(kartlar, odak.durakId) : null);
  const metin = hedef ? siradakiMetni(hedef.ad, hedef.varisDk !== null ? dakikaSaat(hedef.varisDk) : null) : null;
  useEffect(() => {
    onMetin?.(metin);
  }, [metin, onMetin]);
  if (!metin) return null;
  return (
    <Text style={stil} numberOfLines={1} testID="kart-siradaki">
      {metin}
    </Text>
  );
}
