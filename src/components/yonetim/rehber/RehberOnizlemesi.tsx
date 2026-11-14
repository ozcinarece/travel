import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { View } from 'react-native';

import { SehirRehberi } from '@/components/icerik/SehirRehberi';
import type { BilinenMekanlar } from '@/features/icerik/mekanBilgileri';
import { ty } from '@/features/yonetim/metin';
import { onizlemeNo, onizlemeSatirlari, type TaslakBolum } from '@/features/yonetim/rehberTaslak';
import type { Sehir } from '@/lib/tipler';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

const GENISLIK = 390;
const OLCEK = 0.789;
/** Kanvas: 324 × 700 çerçeve, 8 px Lacivert kenar; içerik 390 genişlikte, %78,9. */
const YUKSEKLIK = Math.round((700 - 16) / OLCEK);

type Props = {
  sehir: Sehir;
  bolumler: TaslakBolum[];
  /** #172 KK7: taslağın bildiği mekanlar (yayından önce DB'de yazı satırı yok) — kartlar Google'a sorulmadan çizilir. */
  bilinen?: BilinenMekanlar;
  seciliId: string;
  acik: boolean;
  onAcik: (acik: boolean) => void;
};

/**
 * #156 KK12 (kanvas BO-1 sağ sütun, 360 px): "UYGULAMADA" + Bu bölüm / Tüm sayfa + × (gizle → 56 px şerit, editör genişler).
 * Telefon önizlemesi **uygulamanın kendi `SehirRehberi` bileşeniyle** çizilir: taslak, ayrı bir sorgu istemcisinde uygulamanın
 * rehber sorgusunun yerine konur (yapışkan çipler, okuma çizgisi, kart, alıntı uygulamadaki gibi); yazdıkça güncellenir.
 */
export function RehberOnizlemesi({ sehir, bolumler, bilinen, seciliId, acik, onAcik }: Props) {
  const [kapsam, setKapsam] = useState<'bolum' | 'sayfa'>('sayfa');
  // Önizlemenin kendi önbelleği: taslak uygulamanın `['icerik', 'rehber', id]` sorgusuna yazılır, panelinkine dokunmaz.
  const istemci = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }), []);
  const yalniz = kapsam === 'bolum' && bolumler.some((b) => b.id === seciliId) ? seciliId : undefined;
  const satirlar = useMemo(() => onizlemeSatirlari(sehir.id, bolumler, yalniz), [sehir.id, bolumler, yalniz]);
  useEffect(() => {
    istemci.setQueryData(['icerik', 'rehber', sehir.id], satirlar);
  }, [istemci, sehir.id, satirlar]);
  if (!istemci.getQueryData(['icerik', 'rehber', sehir.id])) istemci.setQueryData(['icerik', 'rehber', sehir.id], satirlar);

  if (!acik) {
    return (
      <aside style={c.serit}>
        <button type="button" aria-label={ty('rehberEditor.onizleme.goster')} onClick={() => onAcik(true)} style={c.seritDugme}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={yRenk.ana} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="6" y="2" width="12" height="20" rx="3" />
            <path d="M11 18h2" />
          </svg>
        </button>
        <span style={c.dikey}>{ty('rehberEditor.onizleme.baslik')}</span>
      </aside>
    );
  }

  return (
    <aside style={c.kap}>
      <div style={c.ust}>
        <div style={c.etiket}>{ty('rehberEditor.onizleme.etiket')}</div>
        <div role="radiogroup" style={c.segment}>
          {(['bolum', 'sayfa'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kapsam === k} onClick={() => setKapsam(k)} style={{ ...c.segmentDugme, ...(kapsam === k ? c.segmentSecili : null) }}>
              {ty(k === 'bolum' ? 'rehberEditor.onizleme.buBolum' : 'rehberEditor.onizleme.tumSayfa')}
            </button>
          ))}
          <button type="button" aria-label={ty('rehberEditor.onizleme.gizle')} onClick={() => onAcik(false)} style={{ ...c.segmentDugme, width: 26, padding: 0 }}>
            ×
          </button>
        </div>
      </div>
      <div style={c.telefon}>
        <div style={c.olcek}>
          <QueryClientProvider client={istemci}>
            <View style={{ width: GENISLIK, height: YUKSEKLIK }}>
              <SehirRehberi key={yalniz ?? 'sayfa'} sehir={sehir} sehirlerYukleniyor={false} onGeri={() => {}} ilkNo={yalniz ? onizlemeNo(bolumler, yalniz) : 1} bilinen={bilinen} />
            </View>
          </QueryClientProvider>
        </div>
      </div>
      <div style={c.not}>{ty('rehberEditor.onizleme.not')}</div>
    </aside>
  );
}

const c: Record<string, CSSProperties> = {
  kap: { width: 360, flexShrink: 0, background: yRenk.zemin, borderLeft: `1px solid ${yRenk.ayrac}`, padding: '16px 18px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' },
  ust: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: '0.06em', color: yRenk.ikincil },
  segment: { display: 'flex', gap: 2, padding: 3, borderRadius: 10, background: yRenk.yuzey },
  segmentDugme: { height: 26, padding: '0 10px', border: 0, borderRadius: 8, background: 'transparent', color: yRenk.ikincil, fontFamily: yazi.ekstra, fontSize: 12, cursor: 'pointer' },
  segmentSecili: { background: yRenk.zemin, color: yRenk.metin },
  telefon: { width: 324, height: 700, flexShrink: 0, borderRadius: 32, border: `8px solid ${yRenk.metin}`, boxSizing: 'border-box', overflow: 'hidden', position: 'relative', background: yRenk.zemin },
  olcek: { width: GENISLIK, height: YUKSEKLIK, transform: `scale(${OLCEK})`, transformOrigin: 'top left' },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 1.45, color: yRenk.ikincil },
  serit: { width: 56, flexShrink: 0, background: yRenk.zemin, borderLeft: `1px solid ${yRenk.ayrac}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 10 },
  seritDugme: { width: 40, height: 40, border: 0, borderRadius: 12, background: yRenk.yuzey, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  dikey: { writingMode: 'vertical-rl', fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.ikincil },
};
