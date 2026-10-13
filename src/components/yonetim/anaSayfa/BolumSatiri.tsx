import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BOLUM_TURLERI, bolumOzeti, icerikTuru, icerikYaz, seciliIdler, type TaslakBolum } from '@/features/yonetim/anaSayfa';
import { tasi, yerelTarihGirdisi, yerelTarihtenIso } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import type { BolumKaynagi, BolumTuru } from '@/lib/anaSayfa';
import { yazi } from '@/theme';

import { Alan, AlanSatiri, MetinKutusu, SecimKutusu, TarihKutusu } from '../Form';
import { Hap } from '../Hap';
import { useSuruklenen } from '../surukle';
import { yRenk } from '../tema';

type Adli = { id: string; ad: string };
export type IcerikSecenekleri = { geziler: readonly { id: string; baslik: string }[]; yerler: readonly Adli[]; sehirler: readonly Adli[] };

type Props = {
  bolum: TaslakBolum;
  indeks: number;
  secenekler: IcerikSecenekleri;
  acik: boolean;
  onAcKapa: () => void;
  onGuncelle: (alanlar: Partial<Omit<TaslakBolum, 'id'>>) => void;
  onSil: () => void;
  onBirak: (kaynak: number, hedef: number) => void;
};

const TUTAMAC = 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01';

/**
 * KK3 (kanvas ekran 3 satırı): 16 px tutamaç (sürükle = sıra), başlık + "· tür", alt satırda içerik ve kaynak, 38 × 22
 * anahtar (açık/kapalı), "Düzenle". Düzenleyici kanvasta yok (tasarım bekliyor): alan kutusu ve satır stiliyle.
 */
export function BolumSatiri({ bolum, indeks, secenekler, acik, onAcKapa, onGuncelle, onSil, onBirak }: Props) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, 'ana-sayfa', indeks, onBirak);
  return (
    <View style={s.kap}>
      <View ref={ref} style={s.satir}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={yRenk.yerTutucu} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Path d={TUTAMAC} />
        </Svg>
        <View style={s.metinler}>
          <Text style={s.baslik} numberOfLines={1}>
            {bolum.baslik}
            <Text style={s.tur}>{` · ${ty(`anaSayfa.tur.${bolum.tur}`)}`}</Text>
          </Text>
          <Text style={s.ozet} numberOfLines={1}>
            {bolumOzeti(bolum, secenekler, ty)}
          </Text>
        </View>
        <Anahtar acik={bolum.acik} etiket={ty('anaSayfa.acikKapali', { baslik: bolum.baslik })} onDegis={(a) => onGuncelle({ acik: a })} />
        <Hap kucuk baslik={ty(acik ? 'anaSayfa.kapat' : 'anaSayfa.duzenle')} onPress={onAcKapa} />
      </View>
      {acik ? <Duzenleyici bolum={bolum} secenekler={secenekler} onGuncelle={onGuncelle} onSil={onSil} /> : null}
    </View>
  );
}

/** Kanvas anahtarı: 38 × 22; açık siyah, düğme sağda; kapalı #d9d9d4, düğme solda. */
export function Anahtar({ acik, etiket, onDegis }: { acik: boolean; etiket: string; onDegis: (a: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={etiket} accessibilityState={{ checked: acik }} onPress={() => onDegis(!acik)} style={[s.anahtar, { backgroundColor: acik ? yRenk.metin : yRenk.cerceve }]}>
      <View style={[s.dugme, acik ? { right: 3 } : { left: 3 }]} />
    </Pressable>
  );
}

function Duzenleyici({ bolum, secenekler, onGuncelle, onSil }: { bolum: TaslakBolum; secenekler: IcerikSecenekleri; onGuncelle: Props['onGuncelle']; onSil: () => void }) {
  const [baslik, setBaslik] = useState(bolum.baslik);
  const [silOnay, setSilOnay] = useState(false);
  const tur = icerikTuru(bolum.tur);
  const liste: Adli[] = tur === 'gezi' ? secenekler.geziler.map((g) => ({ id: g.id, ad: g.baslik })) : tur === 'yer' ? [...secenekler.yerler] : [...secenekler.sehirler];
  const secili = seciliIdler(bolum);
  const kalan = liste.filter((x) => !secili.includes(x.id));
  const yaz = (idler: string[]) => onGuncelle({ icerik: icerikYaz(bolum.tur, idler) });
  const elleSecim = bolum.kaynak === 'elle' || bolum.tur === 'sehir_seckisi';

  return (
    <View style={s.duzenleyici}>
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.baslik')}>
          <MetinKutusu value={baslik} onChangeText={setBaslik} onBlur={() => baslik.trim() && baslik !== bolum.baslik && onGuncelle({ baslik: baslik.trim() })} maxLength={80} accessibilityLabel={ty('anaSayfa.alan.baslik')} />
        </Alan>
        <Alan etiket={ty('anaSayfa.alan.tur')} genislik={150}>
          <SecimKutusu<BolumTuru>
            etiket={ty('anaSayfa.alan.tur')}
            deger={bolum.tur}
            onDegis={(t) => onGuncelle({ tur: t, icerik: icerikYaz(t, []), kaynak: t === 'sehir_seckisi' ? 'elle' : bolum.kaynak })}
            secenekler={BOLUM_TURLERI.map((t) => ({ deger: t, etiket: ty(`anaSayfa.turAd.${t}`) }))}
          />
        </Alan>
        {bolum.tur !== 'sehir_seckisi' ? (
          <Alan etiket={ty('anaSayfa.alan.kaynak')} genislik={120}>
            <SecimKutusu<BolumKaynagi>
              etiket={ty('anaSayfa.alan.kaynak')}
              deger={bolum.kaynak}
              onDegis={(kaynak) => onGuncelle({ kaynak })}
              secenekler={[
                { deger: 'otomatik', etiket: ty('anaSayfa.kaynak.otomatik') },
                { deger: 'elle', etiket: ty('anaSayfa.kaynak.elle') },
              ]}
            />
          </Alan>
        ) : null}
      </AlanSatiri>
      {elleSecim ? (
        <Alan etiket={ty('anaSayfa.alan.icerik')}>
          <View style={s.secililer}>
            {secili.map((id, i) => (
              <IcerikSatiri key={id} id={id} indeks={i} bolumId={bolum.id} ad={liste.find((x) => x.id === id)?.ad ?? id} onCikar={() => yaz(secili.filter((x) => x !== id))} onBirak={(k, h) => yaz(tasi(secili, k, h))} />
            ))}
            {(bolum.tur !== 'tek_kart' || secili.length === 0) && kalan.length ? (
              <SecimKutusu
                etiket={ty('anaSayfa.alan.ekle')}
                deger=""
                onDegis={(id) => id && yaz(bolum.tur === 'tek_kart' ? [id] : [...secili, id])}
                secenekler={[{ deger: '', etiket: ty('anaSayfa.ekleSec') }, ...kalan.map((x) => ({ deger: x.id, etiket: x.ad }))]}
              />
            ) : null}
          </View>
        </Alan>
      ) : null}
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.baslangic')} genislik={220}>
          <TarihKutusu etiket={ty('anaSayfa.alan.baslangic')} deger={yerelTarihGirdisi(bolum.baslangic_at)} onDegis={(g) => onGuncelle({ baslangic_at: yerelTarihtenIso(g) })} />
        </Alan>
        <Alan etiket={ty('anaSayfa.alan.bitis')} genislik={220}>
          <TarihKutusu etiket={ty('anaSayfa.alan.bitis')} deger={yerelTarihGirdisi(bolum.bitis_at)} onDegis={(g) => onGuncelle({ bitis_at: yerelTarihtenIso(g) })} />
        </Alan>
        <View style={s.sil}>
          <Hap kucuk baslik={ty(silOnay ? 'anaSayfa.silOnay' : 'anaSayfa.sil')} onPress={() => (silOnay ? onSil() : setSilOnay(true))} />
        </View>
      </AlanSatiri>
    </View>
  );
}

function IcerikSatiri({ id, indeks, bolumId, ad, onCikar, onBirak }: { id: string; indeks: number; bolumId: string; ad: string; onCikar: () => void; onBirak: (k: number, h: number) => void }) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, `icerik-${bolumId}`, indeks, onBirak);
  return (
    <View ref={ref} style={s.icerikSatir}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.yerTutucu} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d={TUTAMAC} />
      </Svg>
      <Text style={s.icerikAd} numberOfLines={1}>
        {ad}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={ty('anaSayfa.cikar', { ad })} onPress={onCikar} hitSlop={8}>
        <Text style={s.carpi}>×</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { borderRadius: 12, borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  metinler: { flex: 1, minWidth: 0, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  tur: { fontFamily: yazi.kalin, fontSize: 11, color: yRenk.ikincil },
  ozet: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
  anahtar: { width: 38, height: 22, borderRadius: 999 },
  dugme: { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: yRenk.zemin },
  duzenleyici: { gap: 12, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: yRenk.ayrac, paddingTop: 12 },
  secililer: { gap: 6 },
  icerikSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac },
  icerikAd: { flex: 1, fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  carpi: { fontFamily: yazi.normal, fontSize: 12.5, color: yRenk.ikincil },
  sil: { justifyContent: 'flex-end', marginLeft: 'auto' },
});
