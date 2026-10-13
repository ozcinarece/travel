import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { ty } from '@/features/yonetim/metin';
import { bolumKartSayisi, type TaslakBolum } from '@/features/yonetim/rehberTaslak';
import { KAPAK_OZET } from '@/features/yonetim/rehberYazari';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

type Props = {
  bolumler: TaslakBolum[];
  seciliId: string;
  mekanSayisi: number;
  onSec: (id: string) => void;
  onEkle: () => void;
  onAdlandir: (id: string, baslik: string) => void;
  onCogalt: (id: string) => void;
  onGizle: (id: string, gizli: boolean) => void;
  onTasi: (id: string, yon: -1 | 1) => void;
  onYerlestir: (bolumler: TaslakBolum[]) => void;
  onSil: (id: string) => void;
};

/**
 * #156 KK8 / KK10 / KK11 (kanvas BO-1 / BO-2 sol sütun, 250 px): SAYFA › "Kapak ve özet" (sabit en üst); BÖLÜMLER — tutamaç
 * (sürükle = sıra), numara (seçili Mandalina), serbest ad, "N mekan" (kart), gizliyse soluk + GİZLİ; seçili satırda ···
 * menüsü (Yeniden adlandır F2 · Çoğalt · Uygulamada gizle · Yukarı / Aşağı taşı ⌥↑↓ · Bölümü sil); kesikli "+ Bölüm ekle";
 * altta "Rehberdeki mekanlar · N".
 */
export function BolumListesi({ bolumler, seciliId, mekanSayisi, onSec, onEkle, onAdlandir, onCogalt, onGizle, onTasi, onYerlestir, onSil }: Props) {
  const [menu, setMenu] = useState<string | null>(null);
  const [adlandirilan, setAdlandirilan] = useState<string | null>(null);
  const [suruklenen, setSuruklenen] = useState<string | null>(null);

  // F2 = yeniden adlandır, ⌥↑↓ = taşı (seçili bölümde; yazı alanındayken değil).
  useEffect(() => {
    const dinle = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      if (seciliId === KAPAK_OZET || hedef?.isContentEditable || hedef?.tagName === 'INPUT' || hedef?.tagName === 'TEXTAREA') return;
      if (e.key === 'F2') {
        e.preventDefault();
        setAdlandirilan(seciliId);
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        onTasi(seciliId, e.key === 'ArrowUp' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', dinle);
    return () => window.removeEventListener('keydown', dinle);
  }, [seciliId, onTasi]);

  const birak = (hedefId: string) => {
    if (!suruklenen || suruklenen === hedefId) return;
    const tasinan = bolumler.find((b) => b.id === suruklenen)!;
    const kalan = bolumler.filter((b) => b.id !== suruklenen);
    kalan.splice(kalan.findIndex((b) => b.id === hedefId) + (bolumler.findIndex((b) => b.id === suruklenen) < bolumler.findIndex((b) => b.id === hedefId) ? 1 : 0), 0, tasinan);
    onYerlestir(kalan);
  };

  return (
    <aside style={c.kap}>
      <div style={c.etiket}>{ty('rehberEditor.sayfa')}</div>
      <button type="button" aria-pressed={seciliId === KAPAK_OZET} onClick={() => onSec(KAPAK_OZET)} style={{ ...c.kapak, ...(seciliId === KAPAK_OZET ? c.secili : null) }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={yRenk.ikincil} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 15l5-4 4 3 3-2 6 4" />
        </svg>
        {ty('rehberEditor.kapakOzet')}
      </button>
      <div style={{ ...c.etiket, paddingTop: 14 }}>{ty('rehberEditor.bolumler')}</div>
      {bolumler.map((b, i) => {
        const secili = b.id === seciliId;
        const kart = bolumKartSayisi(b);
        return (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
            aria-pressed={secili}
            aria-label={b.baslik}
            onClick={() => onSec(b.id)}
            onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onSec(b.id)}
            onDragOver={(e) => suruklenen && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              birak(b.id);
              setSuruklenen(null);
            }}
            style={{ ...c.satir, ...(secili ? c.secili : null), ...(suruklenen === b.id ? { opacity: 0.4 } : null) }}>
            <span
              draggable
              aria-label={ty('rehberEditor.blok.tutamac')}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', b.id);
                setSuruklenen(b.id);
              }}
              onDragEnd={() => setSuruklenen(null)}
              style={{ display: 'flex', cursor: 'grab', opacity: b.gizli ? 0.55 : 1 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill={secili ? '#7f93d6' : yRenk.yerTutucu} aria-hidden>
                {[6, 12, 18].flatMap((y) => [<circle key={`a${y}`} cx="9" cy={y} r="1.7" />, <circle key={`b${y}`} cx="15" cy={y} r="1.7" />])}
              </svg>
            </span>
            <span style={{ ...c.no, ...(secili ? c.noSecili : null), opacity: b.gizli ? 0.55 : 1 }}>{String(i + 1).padStart(2, '0')}</span>
            {adlandirilan === b.id ? (
              <AdGirdisi
                ilk={b.baslik}
                onBitti={(ad) => {
                  setAdlandirilan(null);
                  if (ad && ad !== b.baslik) onAdlandir(b.id, ad);
                }}
              />
            ) : (
              <span style={{ ...c.ad, ...(secili ? { color: yRenk.ana } : null), opacity: b.gizli ? 0.55 : 1 }}>{b.baslik}</span>
            )}
            {b.gizli ? <span style={c.gizli}>{ty('rehberEditor.gizliRozet')}</span> : kart ? <span style={c.sayi}>{ty('rehberEditor.mekanSayi', { n: kart })}</span> : null}
            {secili ? (
              <button
                type="button"
                aria-label={ty('rehberEditor.menu.ac')}
                aria-expanded={menu === b.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(menu === b.id ? null : b.id);
                }}
                style={{ ...c.menuDugme, ...(menu === b.id ? { background: yRenk.ana } : null) }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill={menu === b.id ? yRenk.zemin : yRenk.ana} aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            ) : null}
            {menu === b.id ? (
              <BolumMenusu
                gizli={b.gizli}
                ilk={i === 0}
                son={i === bolumler.length - 1}
                onKapat={() => setMenu(null)}
                onAdlandir={() => setAdlandirilan(b.id)}
                onCogalt={() => onCogalt(b.id)}
                onGizle={() => onGizle(b.id, !b.gizli)}
                onTasi={(yon) => onTasi(b.id, yon)}
                onSil={() => onSil(b.id)}
              />
            ) : null}
          </div>
        );
      })}
      <button type="button" onClick={onEkle} style={c.ekle}>
        {ty('rehberEditor.bolumEkle')}
      </button>
      <div style={c.not}>{ty('rehberEditor.ipucu')}</div>
      <div style={c.mekanlar}>
        <div style={c.mekanlarBaslik}>{ty('rehberEditor.rehberMekanlari', { n: mekanSayisi })}</div>
        <div style={c.mekanlarAciklama}>{ty('rehberEditor.rehberMekanlariAciklama', { n: mekanSayisi })}</div>
      </div>
    </aside>
  );
}

function AdGirdisi({ ilk, onBitti }: { ilk: string; onBitti: (ad: string) => void }) {
  const [ad, setAd] = useState(ilk);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <input
      ref={ref}
      value={ad}
      maxLength={120}
      aria-label={ty('rehberEditor.menu.adlandir')}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setAd(e.target.value)}
      onBlur={() => onBitti(ad.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onBitti(ad.trim());
        if (e.key === 'Escape') onBitti(ilk);
      }}
      style={c.adGirdi}
    />
  );
}

function BolumMenusu({
  gizli,
  ilk,
  son,
  onKapat,
  onAdlandir,
  onCogalt,
  onGizle,
  onTasi,
  onSil,
}: {
  gizli: boolean;
  ilk: boolean;
  son: boolean;
  onKapat: () => void;
  onAdlandir: () => void;
  onCogalt: () => void;
  onGizle: () => void;
  onTasi: (yon: -1 | 1) => void;
  onSil: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const disari = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onKapat();
    const t = setTimeout(() => document.addEventListener('mousedown', disari));
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', disari);
    };
  }, [onKapat]);
  const oge = (etiket: string, ipucu: string, is: () => void, ek?: CSSProperties, pasif?: boolean) => (
    <button
      type="button"
      role="menuitem"
      disabled={pasif}
      onClick={(e) => {
        e.stopPropagation();
        onKapat();
        is();
      }}
      style={{ ...c.menuOge, ...ek, ...(pasif ? { opacity: 0.4 } : null) }}>
      {etiket}
      <span style={c.menuIpucu}>{ipucu}</span>
    </button>
  );
  return (
    <div ref={ref} role="menu" style={c.menu} onClick={(e) => e.stopPropagation()}>
      {oge(ty('rehberEditor.menu.adlandir'), 'F2', onAdlandir)}
      {oge(ty('rehberEditor.menu.cogalt'), '', onCogalt)}
      {oge(ty(gizli ? 'rehberEditor.menu.goster' : 'rehberEditor.menu.gizle'), gizli ? '' : ty('rehberEditor.menu.gizleNot'), onGizle)}
      {oge(ty('rehberEditor.menu.yukari'), '⌥↑', () => onTasi(-1), undefined, ilk)}
      {oge(ty('rehberEditor.menu.asagi'), '⌥↓', () => onTasi(1), undefined, son)}
      <div style={c.ayrac} />
      {oge(ty('rehberEditor.menu.sil'), '', onSil, { color: yRenk.hata })}
    </div>
  );
}

const c: Record<string, CSSProperties> = {
  // ··· menüsü sütunun dışına taşar (kanvas): kırpılmaz, ortadaki kâğıdın üstünde kalır.
  kap: { position: 'relative', zIndex: 3, width: 250, flexShrink: 0, background: yRenk.zemin, borderRight: `1px solid ${yRenk.ayrac}`, padding: '16px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 4 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: '0.06em', color: yRenk.ikincil, padding: '0 8px 6px' },
  kapak: { height: 40, padding: '0 10px', border: 0, borderRadius: 10, background: 'transparent', display: 'flex', alignItems: 'center', gap: 8, fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin, cursor: 'pointer', textAlign: 'left' },
  secili: { background: yRenk.yuzey },
  satir: { position: 'relative', height: 44, padding: '0 8px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', outline: 'none' },
  no: { width: 26, height: 26, flexShrink: 0, borderRadius: 8, background: yRenk.yuzey, color: yRenk.ana, fontFamily: yazi.ekstra, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  noSecili: { background: yRenk.vurgu, color: yRenk.metin },
  ad: { flex: 1, minWidth: 0, fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  adGirdi: { flex: 1, minWidth: 0, height: 30, padding: '0 8px', border: `1.5px solid ${yRenk.ana}`, borderRadius: 8, fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin, outline: 'none' },
  sayi: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil, whiteSpace: 'nowrap' },
  gizli: { height: 20, padding: '0 6px', borderRadius: 6, background: yRenk.yuzey, fontFamily: yazi.ekstra, fontSize: 10, color: yRenk.ikincil, display: 'flex', alignItems: 'center' },
  menuDugme: { width: 26, height: 26, flexShrink: 0, border: 0, borderRadius: 8, background: yRenk.zemin, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 },
  menu: { position: 'absolute', left: 150, top: 36, zIndex: 6, width: 230, padding: 6, borderRadius: 14, background: yRenk.zemin, boxShadow: '0 16px 40px rgba(14,20,48,0.18)', display: 'flex', flexDirection: 'column' },
  menuOge: { height: 38, padding: '0 10px', border: 0, borderRadius: 9, background: 'transparent', color: yRenk.metin, fontFamily: yazi.kalin, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' },
  menuIpucu: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
  ayrac: { height: 1, background: yRenk.ayrac, margin: '4px 6px' },
  ekle: { marginTop: 6, height: 40, border: `1.5px dashed ${yRenk.yerTutucu}`, borderRadius: 10, background: yRenk.zemin, color: yRenk.ana, fontFamily: yazi.ekstra, fontSize: 14, cursor: 'pointer' },
  not: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 1.45, color: yRenk.ikincil, padding: '8px 8px 0' },
  mekanlar: { marginTop: 'auto', padding: 12, borderRadius: 14, background: '#fff4ec', display: 'flex', flexDirection: 'column', gap: 4 },
  mekanlarBaslik: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  mekanlarAciklama: { fontFamily: yazi.normal, fontSize: 12, lineHeight: 1.4, color: yRenk.ikincil },
};
