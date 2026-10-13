import type { CSSProperties } from 'react';

import { ty } from '@/features/yonetim/metin';
import { mekanBaskaBolumde, type TaslakBolum } from '@/features/yonetim/rehberTaslak';
import type { HafifYer, Merkez } from '@/features/yerler/api';
import { yazi } from '@/theme';

import { yRenk } from '../tema';
import { BlokEditoru } from './BlokEditoru';

type Props = {
  bolum: TaslakBolum;
  no: number;
  bolumler: TaslakBolum[];
  merkez: Merkez | undefined;
  fotoYukle: (dosya: File) => Promise<string>;
  onHata: (m: string) => void;
  onMekanSecildi: (y: HafifYer) => void;
  onDegis: (alan: Partial<TaslakBolum>) => void;
};

/**
 * #156 KK1 (kanvas BO-1 orta): Buz üstünde beyaz kâğıt (24 köşe, 34 / 44 iç boşluk) — "BÖLÜM 02", Archivo 32 başlık,
 * "özet · İÇİNDEKİLER SATIRI", ardından uygulamadaki gibi görünen blok editörü.
 */
export function RehberKagidi({ bolum, no, bolumler, merkez, fotoYukle, onHata, onMekanSecildi, onDegis }: Props) {
  return (
    <div style={c.kagit}>
      <div style={c.no}>{ty('rehberEditor.bolumNo', { no: String(no).padStart(2, '0') })}</div>
      <input
        value={bolum.baslik}
        maxLength={120}
        aria-label={ty('rehberEditor.baslikYerTutucu')}
        placeholder={ty('rehberEditor.baslikYerTutucu')}
        onChange={(e) => onDegis({ baslik: e.target.value.replace(/\n/g, ' ') })}
        onBlur={(e) => !e.target.value.trim() && onDegis({ baslik: ty('rehberEditor.yeniBolum') })}
        style={c.baslik}
      />
      <div style={c.ozetSatir}>
        <input
          value={bolum.ozet ?? ''}
          maxLength={200}
          aria-label={ty('rehberEditor.ozetYerTutucu')}
          placeholder={ty('rehberEditor.ozetYerTutucu')}
          onChange={(e) => onDegis({ ozet: e.target.value || null })}
          style={c.ozet}
        />
        <span style={c.icindekiler}>{ty('rehberEditor.icindekiler')}</span>
      </div>
      {bolum.gizli ? <div style={c.gizli}>{ty('rehberEditor.gizliNot')}</div> : null}
      <BlokEditoru
        key={bolum.id}
        md={bolum.govde}
        onDegis={(govde) => onDegis({ govde })}
        merkez={merkez}
        fotoYukle={fotoYukle}
        onHata={onHata}
        onMekanSecildi={onMekanSecildi}
        baskaBolumde={(placeId) => mekanBaskaBolumde(placeId, bolumler, bolum.id)}
      />
    </div>
  );
}

const c: Record<string, CSSProperties> = {
  kagit: { width: '100%', maxWidth: 700, margin: '0 auto', background: yRenk.zemin, borderRadius: 24, boxShadow: '0 10px 30px rgba(21,42,107,0.08)', padding: '34px 48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 },
  no: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: '0.08em', color: yRenk.ikincil },
  baslik: { border: 0, outline: 'none', padding: 0, marginTop: -8, background: 'transparent', fontFamily: yazi.baslik, fontSize: 32, lineHeight: 1.05, letterSpacing: '-0.03em', color: yRenk.metin, width: '100%' },
  ozetSatir: { marginTop: -6, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  // Genişlik içeriğe göre (Chromium `field-sizing`); başka tarayıcıda 60 karakterlik kutu.
  ozet: { border: 0, outline: 'none', padding: 0, background: 'transparent', fontFamily: yazi.normal, fontSize: 14, color: yRenk.soluk, maxWidth: '100%', minWidth: 80, fieldSizing: 'content' } as CSSProperties,
  icindekiler: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.yerTutucu },
  gizli: { padding: '8px 12px', borderRadius: 10, background: yRenk.yuzey, fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
};
