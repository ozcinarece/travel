import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { ty } from '@/features/yonetim/metin';
import { hafifYerler, linkCoz, linkGibiMi, useOneriler, yeniOturumJetonu, type HafifYer, type Merkez } from '@/features/yerler/api';
import { kategoriEtiketi } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

export type MekanBicimi = 'kart' | 'metin';

type Props = {
  merkez: Merkez | undefined;
  /** "Mekanı değiştir" ve "Mekana bağla"da biçim sorulmaz. */
  sabitBicim?: MekanBicimi;
  /** "02 · Ne yenir’de de var" rozeti. */
  baskaBolumde?: (placeId: string) => { no: string; baslik: string } | null;
  onEkle: (yer: HafifYer, bicim: MekanBicimi) => void;
  onVazgec: () => void;
};

/**
 * #156 KK5 (kanvas BO-2 "Mekan ekleme bloğu"): yazının içinde açılır — 2 px Gece çerçeve, 18 köşe. Arama satırı (Buz, 46 px;
 * Google'a şehre yanlı, Maps linki de olur), sonuçlar (36 px kategori rengi kare, ad, "kategori · adres", seçili Buz +
 * "↵ Ekle", başka bölümde varsa sarı rozet), altta Kart olarak / Metne bağla ve klavye ipucu. ↑↓ ↵ Esc.
 */
export function MekanEkleKutusu({ merkez, sabitBicim, baskaBolumde, onEkle, onVazgec }: Props) {
  const [girdi, setGirdi] = useState('');
  const [oturum] = useState(yeniOturumJetonu);
  const [secili, setSecili] = useState(0);
  const [bicim, setBicim] = useState<MekanBicimi>(sabitBicim ?? 'kart');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState(false);
  const alan = useRef<HTMLInputElement>(null);
  const link = linkGibiMi(girdi);
  const oneriler = useOneriler('yonetim-rehber-mekan', girdi, oturum, undefined, merkez, !link);
  const sonuclar = link ? [] : (oneriler.data ?? []).slice(0, 5);

  useEffect(() => alan.current?.focus(), []);

  const ekle = async (indeks = secili) => {
    setMesgul(true);
    setHata(false);
    try {
      const o = sonuclar[indeks];
      const yer = link ? (await linkCoz(girdi.trim(), merkez)).yer : o ? (await hafifYerler([o.place_id], { oturum }))[0] : undefined;
      if (!yer) throw new Error('bos');
      onEkle(yer, bicim);
    } catch {
      setHata(true);
    } finally {
      setMesgul(false);
    }
  };

  const tus = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSecili((i) => Math.min(i + 1, Math.max(sonuclar.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSecili((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (link || sonuclar.length) void ekle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onVazgec();
    }
  };

  return (
    <div style={c.kutu} onKeyDown={tus}>
      <div style={c.ara}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={yRenk.ana} strokeWidth={2.4} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={alan}
          value={girdi}
          aria-label={ty('rehberEditor.mekan.ara')}
          placeholder={ty('rehberEditor.mekan.ara')}
          onChange={(e) => {
            setGirdi(e.target.value);
            setSecili(0);
            setHata(false);
          }}
          style={c.girdi}
        />
        <span style={c.ipucu}>{mesgul || oneriler.isFetching ? '…' : ty('rehberEditor.mekan.linkIpucu')}</span>
      </div>
      {sonuclar.length ? (
        <div role="listbox" aria-label={ty('rehberEditor.mekan.sonuclar')} style={c.liste}>
          {sonuclar.map((o, i) => {
            const tip = o.tipler[0];
            const baska = baskaBolumde?.(o.place_id);
            // Puan için her sonuçta Place Details çağrılmaz (bütçe); yalnız seçilen mekan çözülür.
            const alt = [kategoriEtiketi(tip), o.ikincil].filter(Boolean).join(' · ');
            return (
              <div
                key={o.place_id}
                role="option"
                aria-selected={i === secili}
                onMouseEnter={() => setSecili(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void ekle(i);
                }}
                style={{ ...c.sonuc, ...(i === secili ? c.sonucSecili : null) }}>
                <span style={{ ...c.kare, background: kategoriPini(tip).kategoriRenk }} />
                <span style={c.sonucMetin}>
                  <span style={c.sonucAd}>{o.ana}</span>
                  <span style={c.sonucAlt}>{alt}</span>
                </span>
                {baska ? <span style={c.deVar}>{ty('rehberEditor.mekan.deVar', { no: baska.no, baslik: baska.baslik })}</span> : i === secili ? <span style={c.ekle}>{ty('rehberEditor.mekan.ekleKisa')}</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {hata ? <div style={c.hata}>{ty('rehberEditor.mekan.bulunamadi')}</div> : null}
      <div style={c.alt}>
        {sabitBicim ? null : (
          <div role="radiogroup" style={c.segment}>
            {(['kart', 'metin'] as const).map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={bicim === b}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setBicim(b)}
                style={{ ...c.segmentDugme, ...(bicim === b ? c.segmentSecili : null) }}>
                {ty(`rehberEditor.mekan.${b}`)}
              </button>
            ))}
          </div>
        )}
        <span style={c.klavye}>{ty('rehberEditor.mekan.klavye')}</span>
      </div>
    </div>
  );
}

const c: Record<string, CSSProperties> = {
  kutu: { border: `2px solid ${yRenk.ana}`, borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: yRenk.zemin },
  ara: { display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 12px', borderRadius: 12, background: yRenk.yuzey },
  girdi: { flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: yazi.yari, fontSize: 15, color: yRenk.metin },
  ipucu: { marginLeft: 'auto', fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil, whiteSpace: 'nowrap' },
  liste: { display: 'flex', flexDirection: 'column', gap: 2 },
  sonuc: { display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, cursor: 'pointer' },
  sonucSecili: { background: yRenk.yuzey },
  kare: { width: 36, height: 36, flexShrink: 0, borderRadius: 10 },
  sonucMetin: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  sonucAd: { fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sonucAlt: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  ekle: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.ana, whiteSpace: 'nowrap' },
  deVar: { height: 22, padding: '0 8px', borderRadius: 7, background: yRenk.bekliyorZemin, color: yRenk.bekliyorMetin, fontFamily: yazi.ekstra, fontSize: 11, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.hata },
  alt: { display: 'flex', alignItems: 'center', gap: 10 },
  segment: { display: 'flex', gap: 2, padding: 3, borderRadius: 10, background: yRenk.yuzey },
  segmentDugme: { height: 30, padding: '0 12px', border: 0, borderRadius: 8, background: 'transparent', color: yRenk.ikincil, fontFamily: yazi.ekstra, fontSize: 13, cursor: 'pointer' },
  segmentSecili: { background: yRenk.zemin, color: yRenk.metin, boxShadow: '0 1px 3px rgba(14,20,48,0.1)' },
  klavye: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
};
