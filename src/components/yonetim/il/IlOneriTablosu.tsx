import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IL_KATEGORILERI, type IlKategori, type IlOneri } from '@/features/yonetim/ilOneri';
import type { IlOneriAlanlari } from '@/features/yonetim/ilOneriSorgulari';
import { ty } from '@/features/yonetim/metin';
import { yazi } from '@/theme';

import { AmacSecimi } from '../amac/AmacSecimi';
import { Alan, MetinKutusu } from '../Form';
import { Hap } from '../Hap';
import { useSuruklenen } from '../surukle';
import { yIl } from '../tema';

type Props = {
  satirlar: IlOneri[];
  onDegis: (id: string, alanlar: IlOneriAlanlari) => void;
  onTasi: (kaynak: number, hedef: number) => void;
  onSil: (id: string) => void;
};

/**
 * #401 KK4 (kanvas BO_IlOnerileri): 14 köşe, 1 px çizgili tablo. Sütunlar 28 · 44 · 230 · 130 · 110 · 80 · esnek · 90, 12 aralık;
 * başlık #F6F7FA, 12 px 700. Satır: ⋮⋮ tutamaç, sıra 15/800, ad 15/700, kategori çipi (26 px, 13 köşe, renkli), ilçe ve km 14 px
 * gri, neden 14 px; sağda 36 × 20 görünürlük anahtarı ve ⋯. Gizli satır %45 soluk.
 */
export function IlOneriTablosu({ satirlar, onDegis, onTasi, onSil }: Props) {
  const [acikId, setAcikId] = useState<string | null>(null);
  return (
    <View style={s.tablo}>
      <View style={[s.satir, s.baslik]}>
        <View style={s.c1} />
        <Text style={[s.baslikMetin, s.c2]}>{ty('ilOneri.sutun.sira')}</Text>
        <Text style={[s.baslikMetin, s.c3]}>{ty('ilOneri.sutun.yer')}</Text>
        <Text style={[s.baslikMetin, s.c4]}>{ty('ilOneri.sutun.kategori')}</Text>
        <Text style={[s.baslikMetin, s.c5]}>{ty('ilOneri.sutun.ilce')}</Text>
        <Text style={[s.baslikMetin, s.c6]}>{ty('ilOneri.sutun.merkeze')}</Text>
        <Text style={[s.baslikMetin, s.c7]}>{ty('ilOneri.sutun.neden')}</Text>
        <Text style={[s.baslikMetin, s.c8, s.sag]}>{ty('ilOneri.sutun.gorunur')}</Text>
      </View>
      {satirlar.map((o, i) => (
        <Satir
          key={o.id}
          oneri={o}
          indeks={i}
          acik={acikId === o.id}
          onAc={() => setAcikId(acikId === o.id ? null : o.id)}
          onDegis={(a) => onDegis(o.id, a)}
          onTasi={onTasi}
          onSil={() => {
            setAcikId(null);
            onSil(o.id);
          }}
        />
      ))}
    </View>
  );
}

function Satir({
  oneri: o,
  indeks,
  acik,
  onAc,
  onDegis,
  onTasi,
  onSil,
}: {
  oneri: IlOneri;
  indeks: number;
  acik: boolean;
  onAc: () => void;
  onDegis: (a: IlOneriAlanlari) => void;
  onTasi: (kaynak: number, hedef: number) => void;
  onSil: () => void;
}) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, 'il-oneri', indeks, onTasi);
  const renk = yIl.kategori[o.kategori];
  return (
    <View ref={ref} style={s.satirKap}>
      <View style={[s.satir, !o.gorunur && s.soluk]}>
        <Text style={[s.tutamac, s.c1]} accessibilityLabel={ty('ilOneri.surukle', { ad: o.ad })}>
          ⋮⋮
        </Text>
        <Text style={[s.sira, s.c2]}>{o.sira}</Text>
        <Text style={[s.ad, s.c3]} numberOfLines={2}>
          {o.ad}
        </Text>
        <View style={s.c4}>
          {/* Kategoriye dokununca değişir: tarayıcının seçim kutusu, kanvastaki çip görünümüyle (panel yalnız web). */}
          <select
            aria-label={ty('ilOneri.kategoriSec', { ad: o.ad })}
            value={o.kategori}
            onChange={(e) => onDegis({ kategori: e.target.value as IlKategori })}
            style={{ ...cipDom, background: renk.zemin, color: renk.metin }}>
            {IL_KATEGORILERI.map((k) => (
              <option key={k} value={k}>
                {ty(`ilOneri.kategori.${k}`)} ▾
              </option>
            ))}
          </select>
        </View>
        <Text style={[s.gri, s.c5]} numberOfLines={1}>
          {o.ilce ?? ''}
        </Text>
        <Text style={[s.gri, s.c6]}>{o.merkeze_km === null ? '' : ty('ilOneri.km', { km: Math.round(Number(o.merkeze_km)) })}</Text>
        <Text style={[s.neden, s.c7]} numberOfLines={2}>
          {o.neden ?? ''}
        </Text>
        <View style={[s.c8, s.eylem]}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={ty('ilOneri.gorunurEtiket', { ad: o.ad })}
            accessibilityState={{ checked: o.gorunur }}
            onPress={() => onDegis({ gorunur: !o.gorunur })}
            hitSlop={12}
            style={[s.anahtar, { backgroundColor: o.gorunur ? yIl.acik : yIl.kapali }]}>
            <View style={[s.dugme, o.gorunur ? s.dugmeSag : s.dugmeSol]} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ty('ilOneri.menu', { ad: o.ad })}
            accessibilityState={{ expanded: acik }}
            onPress={onAc}
            hitSlop={12}>
            <Text style={s.menu}>⋯</Text>
          </Pressable>
        </View>
      </View>
      {acik ? <Ayrinti oneri={o} onDegis={onDegis} onSil={onSil} /> : null}
    </View>
  );
}

/** ⋯: adı ve neden metnini düzenle, amaçları seç, sil (kanvas yardım satırı). Ad Ece'nin içerik metni (PRD §7). */
function Ayrinti({ oneri: o, onDegis, onSil }: { oneri: IlOneri; onDegis: (a: IlOneriAlanlari) => void; onSil: () => void }) {
  const [ad, setAd] = useState(o.ad);
  const [neden, setNeden] = useState(o.neden ?? '');
  const [silOnay, setSilOnay] = useState(false);
  const adDegisti = ad.trim() !== o.ad && ad.trim().length > 0;
  const degisti = neden.trim() !== (o.neden ?? '');
  return (
    <View style={s.ayrinti}>
      <Alan etiket={ty('ilOneri.ad')}>
        <View style={s.nedenSatir}>
          <MetinKutusu value={ad} onChangeText={setAd} maxLength={120} accessibilityLabel={ty('ilOneri.ad')} style={s.nedenKutu} />
          {adDegisti ? <Hap kucuk tur="birincil" baslik={ty('ilOneri.kaydet')} onPress={() => onDegis({ ad: ad.trim() })} /> : null}
        </View>
      </Alan>
      <Alan etiket={ty('ilOneri.neden')}>
        <View style={s.nedenSatir}>
          <MetinKutusu
            value={neden}
            onChangeText={setNeden}
            maxLength={90}
            placeholder={ty('ilOneri.nedenYerTutucu')}
            accessibilityLabel={ty('ilOneri.neden')}
            style={s.nedenKutu}
          />
          <Text style={s.gri}>{neden.length}/90</Text>
          {degisti ? <Hap kucuk tur="birincil" baslik={ty('ilOneri.kaydet')} onPress={() => onDegis({ neden: neden.trim() || null })} /> : null}
        </View>
      </Alan>
      <AmacSecimi secili={o.amaclar} onDegis={(a) => onDegis({ amaclar: a })} />
      <View style={s.silSatir}>
        <Hap kucuk baslik={ty(silOnay ? 'ilOneri.silOnay' : 'ilOneri.sil')} onPress={() => (silOnay ? onSil() : setSilOnay(true))} />
      </View>
    </View>
  );
}

const cipDom = {
  height: 26,
  padding: '0 10px',
  borderRadius: 13,
  border: 'none',
  fontFamily: yazi.kalin,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
};

const s = StyleSheet.create({
  tablo: { borderWidth: 1, borderColor: yIl.cizgi, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  satirKap: { borderBottomWidth: 1, borderBottomColor: yIl.cizgi },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  baslik: { backgroundColor: yIl.baslikZemin },
  baslikMetin: { fontFamily: yazi.kalin, fontSize: 12, color: yIl.ikincil },
  soluk: { opacity: yIl.gizliSoluk },
  c1: { width: 28 },
  c2: { width: 44 },
  c3: { width: 230 },
  c4: { width: 130, alignItems: 'flex-start' },
  c5: { width: 110 },
  c6: { width: 80 },
  c7: { flex: 1, minWidth: 0 },
  c8: { width: 90 },
  sag: { textAlign: 'right' },
  tutamac: { fontSize: 18, color: yIl.tutamac, cursor: 'grab' } as never,
  sira: { fontFamily: yazi.ekstra, fontSize: 15, color: yIl.metin },
  ad: { fontFamily: yazi.kalin, fontSize: 15, color: yIl.metin },
  gri: { fontFamily: yazi.normal, fontSize: 14, color: yIl.ikincil },
  neden: { fontFamily: yazi.normal, fontSize: 14, color: yIl.metin },
  eylem: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  anahtar: { width: 36, height: 20, borderRadius: 10 },
  dugme: { position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  dugmeSag: { right: 2 },
  dugmeSol: { left: 2 },
  menu: { fontSize: 18, color: yIl.ikincil },
  ayrinti: { paddingHorizontal: 16, paddingLeft: 100, paddingBottom: 16, gap: 14 },
  nedenSatir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nedenKutu: { flex: 1 },
  silSatir: { flexDirection: 'row' },
});
