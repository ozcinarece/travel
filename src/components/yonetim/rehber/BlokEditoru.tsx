import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import {
  blokId,
  bloklarMd,
  blokTasi,
  blokYerlestir,
  fotoAdresleri,
  htmlMd,
  mdBloklari,
  mdHtml,
  slashSuz,
  slashSuzgeci,
  SLASH_SECENEKLERI,
  type Blok,
  type SlashSecenek,
} from '@/features/yonetim/bloklar';
import { ty } from '@/features/yonetim/metin';
import { useHafifYerler, useYerFotolari, type HafifYer, type Merkez } from '@/features/yerler/api';
import { bilinenKategori } from '@/lib/kategori';
import { icerikFotoUrl } from '@/lib/markdown';
import { puanMetni } from '@/lib/puan';
import { yazi } from '@/theme';

import { dosyaSec } from '../surukle';
import { yRenk } from '../tema';
import { imlecBasta, imlectenBol, imlecSonda, odakla, secimKutusu } from './dom';
import { MekanEkleKutusu, type MekanBicimi } from './MekanEkleKutusu';

type Props = {
  md: string;
  onDegis: (md: string) => void;
  merkez: Merkez | undefined;
  fotoYukle: (dosya: File) => Promise<string>;
  onHata: (mesaj: string) => void;
  /** Seçilen mekan (yayında taslak yer açmak için ad / kategori / konum). */
  onMekanSecildi?: (yer: HafifYer) => void;
  baskaBolumde?: (placeId: string) => { no: string; baslik: string } | null;
  /** Düzenlenen bloğun sırası (önizleme o bloğa kayar). */
  onOdak?: (indeks: number) => void;
};

type MetinTuru = 'paragraf' | 'baslik' | 'ipucu' | 'liste';
type MekanKutusu = { blok: string; mod: 'slash' | 'degistir' | 'baglan' };
/** konum: baş, son ya da metin içinde karakter sırası (Backspace birleştirmesinde birleşme noktası). */
type Odak = { id: string; konum: 'bas' | 'son' | number };

const SLASH_ETIKET = (): Record<SlashSecenek, string[]> =>
  Object.fromEntries(SLASH_SECENEKLERI.map((o) => [o, [ty(`rehberEditor.slash.${o}`), ...ty(`rehberEditor.slashAnahtar.${o}`).split(',')]])) as Record<SlashSecenek, string[]>;

/** Son blok hep boş paragraf: kart / fotoğraftan sonra yazmaya devam edilebilsin (boş paragraf markdown'a yazılmaz). */
function sonaParagraf(bloklar: Blok[]): Blok[] {
  const son = bloklar[bloklar.length - 1];
  return son && son.tur === 'paragraf' && !son.md.trim() ? bloklar : [...bloklar, { id: blokId(), tur: 'paragraf', md: '' }];
}

/**
 * #156 KK1–6 (kanvas BO-1 / BO-2): WYSIWYG blok editörü — sayfa uygulamadaki gibi (Figtree 17 metin, Archivo ara başlık,
 * turuncu alt çizgili mekan bağlantısı, Gece çerçeveli mekan kartı, sarı İPUCU kutusu); doğrudan üstüne yazılır.
 * "/" menüsü (Mekan kartı · Ara başlık · Fotoğraf · İpucu kutusu · Madde listesi; yazdıkça süzülür, ↵ ekler); her bloğun
 * solunda tek tutamaç (boş paragrafta "+", diğerlerinde sürükle); kart / foto seçilince üstte ↑↓ · Mekanı değiştir · Sil;
 * metin seçilince B · I · Mekana bağla (dış bağlantı uygulamada yok). Saklama biçimi markdown (features/yonetim/bloklar).
 */
export function BlokEditoru({ md, onDegis, merkez, fotoYukle, onHata, onMekanSecildi, baskaBolumde, onOdak }: Props) {
  const [bloklar, setBloklar] = useState<Blok[]>(() => sonaParagraf(mdBloklari(md)));
  const yazilan = useRef(md);
  // Üste bildirilip henüz geri gelmemiş yazılar: geri gelen kendi yazımızsa (ara hâl dahil) yeniden ayrıştırılmaz.
  const bildirilen = useRef<string[]>([]);
  // Dışarıdan gelen yazı (bölüm değişti, sürüme dönüldü): yeniden ayrıştır.
  useEffect(() => {
    const i = bildirilen.current.indexOf(md);
    if (i >= 0) {
      bildirilen.current = bildirilen.current.slice(i + 1);
      return;
    }
    if (md === yazilan.current) return;
    yazilan.current = md;
    bildirilen.current = [];
    setBloklar(sonaParagraf(mdBloklari(md)));
  }, [md]);

  const degistir = useCallback(
    (f: (b: Blok[]) => Blok[]) => {
      setBloklar((onceki) => {
        const yeni = sonaParagraf(f(onceki));
        const yeniMd = bloklarMd(yeni);
        if (yeniMd !== yazilan.current) {
          yazilan.current = yeniMd;
          bildirilen.current = [...bildirilen.current, yeniMd].slice(-20);
          // Durum güncellemesi bitince üst bileşene bildir.
          queueMicrotask(() => onDegis(yeniMd));
        }
        return yeni;
      });
    },
    [onDegis],
  );
  const blokGuncelle = (id: string, alan: Partial<Blok>) => degistir((b) => b.map((x) => (x.id === id ? ({ ...x, ...alan } as Blok) : x)));

  const kap = useRef<HTMLDivElement>(null);
  const ogeler = useRef(new Map<string, HTMLElement>());
  // Bekleyen odak (yeni blok çizilince imleç oraya); sayaç yeniden çizimi tetikler.
  const odak = useRef<Odak | null>(null);
  const [odakSayaci, setOdakSayaci] = useState(0);
  const setOdak = (o: Odak) => {
    odak.current = o;
    setOdakSayaci((n) => n + 1);
  };
  useLayoutEffect(() => {
    const o = odak.current;
    if (!o) return;
    const el = ogeler.current.get(o.id);
    if (!el) return;
    odak.current = null;
    odakla(el, o.konum);
  }, [odakSayaci, bloklar]);

  const [seciliBlok, setSeciliBlok] = useState<string | null>(null);
  const [mekanKutusu, setMekanKutusu] = useState<MekanKutusu | null>(null);
  const [slash, setSlash] = useState<{ blok: string; indeks: number } | null>(null);
  const [slashKapali, setSlashKapali] = useState<string | null>(null);
  const kartIdleri = useMemo(() => bloklar.flatMap((b) => (b.tur === 'mekan' ? [b.place_id] : [])), [bloklar]);
  const kartlar = useHafifYerler(kartIdleri);
  // Kartın küçük resmi uygulamadaki gibi (rehber kartı aynı fotoğrafı gösterir; yoksa nötr kare).
  const kartFotolari = useYerFotolari(kartIdleri);

  // ---------------------------------------------------------------- seçim araç çubuğu (B · I · Mekana bağla)
  const [secim, setSecim] = useState<{ x: number; y: number; blok: string } | null>(null);
  const baglanacak = useRef<Range | null>(null);
  useEffect(() => {
    const dinle = () => {
      const sec = window.getSelection();
      const k = kap.current;
      if (!k || !sec || sec.isCollapsed || !sec.anchorNode || !k.contains(sec.anchorNode)) return setSecim(null);
      const metin = (sec.anchorNode.nodeType === 1 ? (sec.anchorNode as Element) : sec.anchorNode.parentElement)?.closest('[data-metin]') as HTMLElement | null;
      if (!metin || metin.dataset.metin === 'baslik') return setSecim(null);
      const kutu = secimKutusu(k);
      if (kutu) setSecim({ x: Math.max(0, kutu.x + kutu.genislik / 2 - 150), y: kutu.y - 48, blok: metin.dataset.blok ?? '' });
    };
    document.addEventListener('selectionchange', dinle);
    return () => document.removeEventListener('selectionchange', dinle);
  }, []);
  const bicimle = (komut: 'bold' | 'italic') => document.execCommand(komut);
  const mekanaBagla = () => {
    const sec = window.getSelection();
    if (!sec?.rangeCount || !secim) return;
    baglanacak.current = sec.getRangeAt(0).cloneRange();
    setMekanKutusu({ blok: secim.blok, mod: 'baglan' });
    setSecim(null);
  };

  // ---------------------------------------------------------------- blok ekleme
  /** `id`'nin altına `yeni` blok; `alan` verilirse `id` aynı güncellemede değişir (tek bildirim, ara hâl yok). */
  const sonrayaEkle = (id: string, yeni: Blok, alan?: Partial<Blok>) => {
    degistir((b) => {
      const i = b.findIndex((x) => x.id === id);
      return [...b.slice(0, i), ...(alan ? [{ ...b[i], ...alan } as Blok] : b.slice(i, i + 1)), yeni, ...b.slice(i + 1)];
    });
    return yeni.id;
  };
  const slashSec = (blok: string, secenek: SlashSecenek) => {
    setSlash(null);
    if (secenek === 'mekan') {
      blokGuncelle(blok, { md: '' });
      setMekanKutusu({ blok, mod: 'slash' });
      return;
    }
    if (secenek === 'foto') {
      blokGuncelle(blok, { md: '' });
      dosyaSec(false, async ([dosya]) => {
        if (!dosya) return;
        try {
          const yol = await fotoYukle(dosya);
          degistir((b) => b.map((x) => (x.id === blok ? { id: blok, tur: 'foto', hedef: `foto:${yol}`, alt: '' } : x)));
        } catch (e) {
          onHata((e as Error).message);
        }
      });
      return;
    }
    const yeni: Blok = secenek === 'liste' ? { id: blok, tur: 'liste', ogeler: [''] } : { id: blok, tur: secenek, md: '' };
    degistir((b) => b.map((x) => (x.id === blok ? yeni : x)));
    setOdak({ id: blok, konum: 'bas' });
  };
  const artiyaBas = (id: string) => {
    const blok = bloklar.find((b) => b.id === id);
    // Boş paragrafta "+": aynı yerde "/" menüsü; değilse altına yeni paragraf + menü.
    const hedef = blok?.tur === 'paragraf' && !blok.md.trim() ? id : blokId();
    if (hedef === id) blokGuncelle(id, { md: '/' });
    else sonrayaEkle(id, { id: hedef, tur: 'paragraf', md: '/' });
    setSlashKapali(null);
    setOdak({ id: hedef, konum: 'son' });
  };

  const mekanSecildi = (yer: HafifYer, bicim: MekanBicimi) => {
    const kutu = mekanKutusu;
    setMekanKutusu(null);
    if (!kutu) return;
    onMekanSecildi?.(yer);
    if (kutu.mod === 'baglan') {
      const r = baglanacak.current;
      const sec = window.getSelection();
      if (r && sec) {
        sec.removeAllRanges();
        sec.addRange(r);
        document.execCommand('createLink', false, `mekan:${yer.place_id}`);
      }
      return;
    }
    if (kutu.mod === 'degistir') return blokGuncelle(kutu.blok, { place_id: yer.place_id });
    if (bicim === 'kart') {
      degistir((b) => b.map((x) => (x.id === kutu.blok ? { id: kutu.blok, tur: 'mekan', place_id: yer.place_id } : x)));
      return;
    }
    const ad = yer.ad.replace(/[[\]]/g, '');
    degistir((b) => b.map((x) => (x.id === kutu.blok ? { id: kutu.blok, tur: 'paragraf', md: `[${ad}](mekan:${yer.place_id}) ` } : x)));
    setOdak({ id: kutu.blok, konum: 'son' });
  };

  // ---------------------------------------------------------------- klavye
  const tus = (e: React.KeyboardEvent<HTMLElement>, blok: Blok) => {
    const el = e.currentTarget;
    const i = bloklar.findIndex((b) => b.id === blok.id);
    const onceki = bloklar[i - 1];
    if (slash?.blok === blok.id) {
      const secenekler = slashSuz(slashSuzgeci((blok as { md: string }).md) ?? '', SLASH_ETIKET());
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = secenekler.length || 1;
        setSlash({ blok: blok.id, indeks: (slash.indeks + (e.key === 'ArrowDown' ? 1 : n - 1)) % n });
        return;
      }
      if (e.key === 'Enter' && secenekler.length) {
        e.preventDefault();
        slashSec(blok.id, secenekler[Math.min(slash.indeks, secenekler.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        setSlashKapali(blok.id);
        return;
      }
    }
    if (blok.tur === 'liste') {
      const li = (window.getSelection()?.anchorNode as Node | null)?.parentElement?.closest('li') ?? null;
      if (e.key === 'Enter' && li && !li.textContent?.trim() && !li.nextElementSibling) {
        // Boş son maddede Enter: listeden çık.
        e.preventDefault();
        li.remove();
        setOdak({ id: sonrayaEkle(blok.id, { id: blokId(), tur: 'paragraf', md: '' }, { ogeler: listeOku(el) }), konum: 'bas' });
      } else if (e.key === 'Enter' && e.shiftKey) {
        // Shift+Enter de yeni madde (satır sonu markdown'da boşluk olurdu).
        e.preventDefault();
        document.execCommand('insertParagraph');
      } else if (e.key === 'Backspace' && imlecBasta(el) && !el.textContent?.trim()) {
        e.preventDefault();
        degistir((b) => b.map((x) => (x.id === blok.id ? { id: blok.id, tur: 'paragraf', md: '' } : x)));
        setOdak({ id: blok.id, konum: 'bas' });
      }
      return;
    }
    // Shift+Enter de Enter gibi: saklama biçiminde satır sonu yok (boşluk olurdu).
    if (e.key === 'Enter') {
      e.preventDefault();
      if (blok.tur === 'paragraf') {
        const { once, sonra } = imlectenBol(el);
        setOdak({ id: sonrayaEkle(blok.id, { id: blokId(), tur: 'paragraf', md: sonra }, { md: once }), konum: 'bas' });
      } else if (imlecSonda(el)) {
        setOdak({ id: sonrayaEkle(blok.id, { id: blokId(), tur: 'paragraf', md: '' }), konum: 'bas' });
      }
      return;
    }
    if (e.key === 'Backspace' && imlecBasta(el) && window.getSelection()?.isCollapsed) {
      if (blok.tur !== 'paragraf') {
        if (!el.textContent?.trim()) {
          e.preventDefault();
          degistir((b) => b.map((x) => (x.id === blok.id ? { id: blok.id, tur: 'paragraf', md: '' } : x)));
          setOdak({ id: blok.id, konum: 'bas' });
        }
        return;
      }
      if (!onceki) return;
      e.preventDefault();
      if (onceki.tur === 'paragraf' || onceki.tur === 'ipucu' || onceki.tur === 'baslik') {
        // Öncekiyle birleş (araya boşluk eklenmez: Enter'ın böldüğü yer aynen birleşir); imleç birleşme noktasında.
        const ek = htmlMd(el);
        const nokta = ogeler.current.get(onceki.id)?.textContent?.length ?? 0;
        degistir((b) => b.filter((x) => x.id !== blok.id).map((x) => (x.id === onceki.id ? ({ ...x, md: `${(x as { md: string }).md}${ek}` } as Blok) : x)));
        setOdak({ id: onceki.id, konum: nokta });
      } else if (!el.textContent?.trim()) {
        degistir((b) => b.filter((x) => x.id !== blok.id));
        setSeciliBlok(onceki.id);
      } else {
        setSeciliBlok(onceki.id);
      }
    }
  };

  const metinDegisti = (blok: Blok, el: HTMLElement) => {
    if (blok.tur === 'liste') return blokGuncelle(blok.id, { ogeler: listeOku(el) });
    const yeniMd = htmlMd(el);
    blokGuncelle(blok.id, { md: yeniMd });
    if (blok.tur === 'paragraf') {
      const suzgec = slashSuzgeci(yeniMd);
      if (suzgec === null) {
        setSlash(null);
        setSlashKapali(null);
      } else if (slashKapali !== blok.id) setSlash((s) => (s?.blok === blok.id ? { blok: blok.id, indeks: 0 } : { blok: blok.id, indeks: 0 }));
    }
  };

  // ---------------------------------------------------------------- sürükle-bırak (tutamaç)
  const [suruklenen, setSuruklenen] = useState<string | null>(null);
  const [hedef, setHedef] = useState<string | null>(null);

  const metinOgesi = (blok: Blok, tur: MetinTuru, html: string, oku: (el: HTMLElement) => string, stil: CSSProperties, yerTutucu?: string) => (
    <Duzenlenebilir
      key={`${blok.id}-${tur}`}
      kayit={(el) => (el ? ogeler.current.set(blok.id, el) : ogeler.current.delete(blok.id))}
      tur={tur}
      blokId={blok.id}
      html={html}
      oku={oku}
      stil={stil}
      yerTutucu={yerTutucu}
      onDegis={(el) => metinDegisti(blok, el)}
      onTus={(e) => tus(e, blok)}
      onOdak={() => {
        setSeciliBlok(null);
        onOdak?.(bloklar.findIndex((b) => b.id === blok.id));
      }}
    />
  );

  const blokIcerigi = (blok: Blok, i: number): ReactNode => {
    switch (blok.tur) {
      case 'paragraf': {
        const sonBos = i === bloklar.length - 1 && !blok.md;
        return metinOgesi(blok, 'paragraf', mdHtml(blok.md), htmlMd, c.paragraf, sonBos ? ty('rehberEditor.yerTutucu') : undefined);
      }
      case 'baslik':
        return metinOgesi(blok, 'baslik', mdHtml(blok.md), htmlMd, c.araBaslik, ty('rehberEditor.slash.baslik'));
      case 'ipucu':
        return (
          <div style={c.ipucu}>
            <div style={c.ipucuEtiket}>{ty('rehberEditor.ipucuEtiket')}</div>
            {metinOgesi(blok, 'ipucu', mdHtml(blok.md), htmlMd, c.ipucuMetin, ty('rehberEditor.ipucuYerTutucu'))}
          </div>
        );
      case 'liste':
        return metinOgesi(blok, 'liste', blok.ogeler.map((o) => `<li>${mdHtml(o) || '<br>'}</li>`).join(''), (el) => listeOku(el).join('\n'), c.liste);
      case 'foto':
        return (
          <div>
            <div style={c.foto} onMouseDown={() => setSeciliBlok(blok.id)}>
              {fotoAdresleri(blok.hedef, icerikFotoUrl).map((url) => (
                <img key={url} src={url} alt={blok.alt} style={c.fotoGorsel} />
              ))}
              <button
                type="button"
                style={c.fotoDegistir}
                onClick={() =>
                  dosyaSec(false, async ([dosya]) => {
                    if (!dosya) return;
                    try {
                      blokGuncelle(blok.id, { hedef: `foto:${await fotoYukle(dosya)}` });
                    } catch (e) {
                      onHata((e as Error).message);
                    }
                  })
                }>
                {ty('rehberEditor.degistir')}
              </button>
            </div>
            <AltYazi deger={blok.alt} onDegis={(alt) => blokGuncelle(blok.id, { alt })} />
          </div>
        );
      case 'mekan': {
        const y = kartlar.data?.[blok.place_id];
        const foto = kartFotolari.data?.get(blok.place_id) ?? null;
        return (
          <div style={{ ...c.kart, ...(seciliBlok === blok.id ? c.kartSecili : null) }} onMouseDown={() => setSeciliBlok(blok.id)} role="group" aria-label={y?.ad ?? blok.place_id}>
            <div style={c.kartKare}>{foto ? <img src={foto} alt="" style={c.kartFoto} /> : null}</div>
            <div style={c.kartMetin}>
              <div style={c.kartAd}>{y?.ad ?? '…'}</div>
              <div style={c.kartAlt}>{[bilinenKategori(y?.primary_type), y && puanMetni(y.puan) ? `★ ${puanMetni(y.puan)}` : null].filter(Boolean).join(' · ')}</div>
            </div>
            <span aria-hidden style={c.kartArti}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={yRenk.metin} strokeWidth={3} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </div>
        );
      }
    }
  };

  const slashSecenekleri = slash ? slashSuz(slashSuzgeci((bloklar.find((b) => b.id === slash.blok) as { md?: string } | undefined)?.md ?? '') ?? '', SLASH_ETIKET()) : [];
  // "/" menüsü bölümün sonunda da görünür alana kayar.
  const slashMenusu = useRef<HTMLDivElement>(null);
  const slashBlok = slash?.blok;
  const slashSayisi = slashSecenekleri.length;
  useEffect(() => {
    if (slashBlok && slashSayisi) slashMenusu.current?.scrollIntoView({ block: 'nearest' });
  }, [slashBlok, slashSayisi]);

  return (
    <div ref={kap} style={c.kap} onMouseDown={(e) => e.target === e.currentTarget && setSeciliBlok(null)}>
      {bloklar.map((blok, i) => {
        const secili = seciliBlok === blok.id;
        const kutuBurada = mekanKutusu && mekanKutusu.blok === blok.id && mekanKutusu.mod !== 'baglan';
        return (
          <div
            key={blok.id}
            data-blok-kap={blok.id}
            style={{ ...c.blok, ...(hedef === blok.id && suruklenen && suruklenen !== blok.id ? c.blokHedef : null) }}
            onDragOver={(e) => {
              if (!suruklenen) return;
              e.preventDefault();
              setHedef(blok.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (suruklenen) degistir((b) => blokYerlestir(b, suruklenen, blok.id));
              setSuruklenen(null);
              setHedef(null);
            }}>
            <div className="blok-oluk" style={c.oluk}>
              {blok.tur === 'paragraf' && !blok.md.trim() ? (
                // Kanvas: boş paragrafta "+" ("/" menüsü), diğer bloklarda tek tutamaç (sürükle).
                <button type="button" aria-label={ty('rehberEditor.blok.ekle')} title={ty('rehberEditor.blok.ekle')} style={c.olukDugme} onMouseDown={(e) => e.preventDefault()} onClick={() => artiyaBas(blok.id)}>
                  +
                </button>
              ) : (
                <span
                  role="button"
                  aria-label={ty('rehberEditor.blok.tutamac')}
                  title={ty('rehberEditor.blok.tutamac')}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', blok.id);
                    setSuruklenen(blok.id);
                  }}
                  onDragEnd={() => {
                    setSuruklenen(null);
                    setHedef(null);
                  }}
                  style={{ ...c.olukDugme, cursor: 'grab' }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="#7f93d6" aria-hidden>
                    {[6, 12, 18].flatMap((y) => [<circle key={`a${y}`} cx="9" cy={y} r="2" />, <circle key={`b${y}`} cx="15" cy={y} r="2" />])}
                  </svg>
                </span>
              )}
            </div>
            {kutuBurada ? (
              <MekanEkleKutusu
                merkez={merkez}
                sabitBicim={mekanKutusu.mod === 'degistir' ? 'kart' : undefined}
                baskaBolumde={baskaBolumde}
                onEkle={mekanSecildi}
                onVazgec={() => {
                  setMekanKutusu(null);
                  setOdak({ id: blok.id, konum: 'son' });
                }}
              />
            ) : (
              blokIcerigi(blok, i)
            )}
            {secili && (blok.tur === 'mekan' || blok.tur === 'foto') && !kutuBurada ? (
              <div style={c.blokArac} role="toolbar">
                <button type="button" aria-label={ty('rehberEditor.blok.yukari')} style={c.aracDugme} onClick={() => degistir((b) => blokTasi(b, blok.id, -1))}>
                  ↑
                </button>
                <button type="button" aria-label={ty('rehberEditor.blok.asagi')} style={c.aracDugme} onClick={() => degistir((b) => blokTasi(b, blok.id, 1))}>
                  ↓
                </button>
                {blok.tur === 'mekan' ? (
                  <button type="button" style={c.aracDugme} onClick={() => setMekanKutusu({ blok: blok.id, mod: 'degistir' })}>
                    {ty('rehberEditor.blok.mekanDegistir')}
                  </button>
                ) : null}
                <button
                  type="button"
                  style={{ ...c.aracDugme, color: yRenk.menuEtiket }}
                  onClick={() => {
                    setSeciliBlok(null);
                    degistir((b) => b.filter((x) => x.id !== blok.id));
                  }}>
                  {ty('rehberEditor.blok.sil')}
                </button>
              </div>
            ) : null}
            {slash?.blok === blok.id && slashSecenekleri.length ? (
              <div ref={slashMenusu} role="listbox" aria-label={ty('rehberEditor.blokEkle')} style={c.slash}>
                <div style={c.slashBaslik}>{ty('rehberEditor.blokEkle')}</div>
                {slashSecenekleri.map((o, k) => (
                  <div
                    key={o}
                    role="option"
                    aria-selected={k === slash.indeks}
                    onMouseEnter={() => setSlash({ blok: blok.id, indeks: k })}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      slashSec(blok.id, o);
                    }}
                    style={{ ...c.slashSecenek, ...(k === slash.indeks ? c.slashSecili : null) }}>
                    <SlashIkonu secenek={o} vurgulu={k === slash.indeks && o === 'mekan'} />
                    <span style={{ flex: 1 }}>
                      <span style={c.slashAd}>{ty(`rehberEditor.slash.${o}`)}</span>
                      {o === 'mekan' ? <span style={c.slashAlt}>{ty('rehberEditor.slash.mekanAlt')}</span> : null}
                    </span>
                    {k === slash.indeks ? <span style={c.slashEnter}>↵</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {mekanKutusu?.mod === 'baglan' ? (
        <div style={c.baglaKutusu}>
          <MekanEkleKutusu merkez={merkez} sabitBicim="metin" baskaBolumde={baskaBolumde} onEkle={mekanSecildi} onVazgec={() => setMekanKutusu(null)} />
        </div>
      ) : null}
      {secim ? (
        <div role="toolbar" aria-label={ty('rehberEditor.secim.etiket')} style={{ ...c.secimArac, left: secim.x, top: secim.y }} onMouseDown={(e) => e.preventDefault()}>
          <button type="button" aria-label={ty('rehberEditor.secim.kalinEtiket')} style={{ ...c.secimDugme, fontFamily: yazi.ekstra }} onClick={() => bicimle('bold')}>
            B
          </button>
          <button type="button" aria-label={ty('rehberEditor.secim.italikEtiket')} style={{ ...c.secimDugme, fontStyle: 'italic' }} onClick={() => bicimle('italic')}>
            I
          </button>
          <button type="button" style={{ ...c.secimDugme, width: 'auto', padding: '0 10px', background: yRenk.vurgu, color: yRenk.metin }} onClick={mekanaBagla}>
            {ty('rehberEditor.secim.mekanaBagla')}
          </button>
        </div>
      ) : null}
      <style>{`.blok-oluk{opacity:0;transition:opacity .12s}[data-blok-kap]:hover>.blok-oluk,[data-blok-kap]:focus-within>.blok-oluk{opacity:1}
[data-metin]:empty::before{content:attr(data-yer-tutucu);color:${yRenk.yerTutucu};pointer-events:none}
[data-metin] a[href^="mekan:"]{font-family:${yazi.ekstra};color:inherit;text-decoration:underline;text-decoration-color:${yRenk.vurgu};text-decoration-thickness:2px;text-underline-offset:3px}
[data-metin] b{font-family:${yazi.ekstra};font-weight:normal}
[data-metin]{outline:none}
[data-metin]::selection,[data-metin] ::selection{background:#c9d2f2;color:${yRenk.ana}}`}</style>
    </div>
  );
}

function listeOku(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('li')).map((li) => htmlMd(li).trim());
}

/** contentEditable öğe: HTML yalnız dışarıdan değişince yazılır (yazarken imleç yerinde kalır). */
function Duzenlenebilir({
  kayit,
  tur,
  blokId: id,
  html,
  oku,
  stil,
  yerTutucu,
  onDegis,
  onTus,
  onOdak,
}: {
  kayit: (el: HTMLElement | null) => void;
  tur: MetinTuru;
  blokId: string;
  html: string;
  oku: (el: HTMLElement) => string;
  stil: CSSProperties;
  yerTutucu?: string;
  onDegis: (el: HTMLElement) => void;
  onTus: (e: React.KeyboardEvent<HTMLElement>) => void;
  onOdak: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const sonHtml = useRef<string | null>(null);
  const baglan = useCallback(
    (el: HTMLElement | null) => {
      ref.current = el;
      kayit(el);
    },
    [kayit],
  );
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || html === sonHtml.current) return;
    // Aynı içerik (yazarken üstten dönen) yeniden yazılmaz.
    const kap = document.createElement(tur === 'liste' ? 'ul' : 'div');
    kap.innerHTML = html;
    if (sonHtml.current !== null && oku(kap) === oku(el)) {
      sonHtml.current = html;
      return;
    }
    el.innerHTML = html;
    sonHtml.current = html;
  }, [html, oku, tur]);
  const ortak = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    'data-metin': tur,
    'data-blok': id,
    'data-yer-tutucu': yerTutucu ?? '',
    role: 'textbox',
    'aria-multiline': tur !== 'baslik',
    'aria-label': yerTutucu,
    style: stil,
    onInput: (e: React.FormEvent<HTMLElement>) => onDegis(e.currentTarget),
    onKeyDown: onTus,
    onFocus: onOdak,
    onPaste: (e: React.ClipboardEvent<HTMLElement>) => {
      // Biçimli yapıştırma yerine düz metin (uygulamanın okumadığı biçim girmesin).
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
    },
  };
  return tur === 'liste' ? <ul {...ortak} ref={baglan} /> : <div {...ortak} ref={baglan} />;
}

function AltYazi({ deger, onDegis }: { deger: string; onDegis: (alt: string) => void }) {
  return (
    <input
      value={deger}
      placeholder={ty('rehberEditor.altyazi')}
      aria-label={ty('rehberEditor.altyazi')}
      onChange={(e) => onDegis(e.target.value.replace(/[[\]]/g, ''))}
      style={c.altyazi}
    />
  );
}

function SlashIkonu({ secenek, vurgulu }: { secenek: SlashSecenek; vurgulu: boolean }) {
  const kare = (cocuk: ReactNode, ek?: CSSProperties) => <span style={{ ...c.slashKare, ...(vurgulu ? { background: yRenk.vurgu } : null), ...ek }}>{cocuk}</span>;
  switch (secenek) {
    case 'mekan':
      return kare(
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={vurgulu ? yRenk.metin : yRenk.ana} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>,
      );
    case 'baslik':
      return kare('H', { fontFamily: yazi.baslik, color: yRenk.ana });
    case 'foto':
      return kare(
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={yRenk.ana} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 15l5-4 4 3 3-2 6 4" />
        </svg>,
      );
    case 'ipucu':
      return kare('!', { background: yRenk.bekliyorZemin, color: yRenk.bekliyorMetin, fontFamily: yazi.ekstra });
    case 'liste':
      return kare(
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={yRenk.ana} strokeWidth={2.4} strokeLinecap="round" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r="1.3" fill={yRenk.ana} />
          <circle cx="4.5" cy="12" r="1.3" fill={yRenk.ana} />
          <circle cx="4.5" cy="18" r="1.3" fill={yRenk.ana} />
        </svg>,
      );
  }
}

const METIN = '#232b48';

const c: Record<string, CSSProperties> = {
  kap: { position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 },
  blok: { position: 'relative', borderRadius: 8 },
  blokHedef: { boxShadow: `0 -3px 0 ${yRenk.vurgu}` },
  oluk: { position: 'absolute', left: -36, top: 2, display: 'flex', flexDirection: 'column', gap: 2 },
  olukDugme: { width: 24, height: 24, border: 0, borderRadius: 7, background: yRenk.yuzey, color: yRenk.ana, fontFamily: yazi.ekstra, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 },
  paragraf: { fontFamily: yazi.normal, fontSize: 17, lineHeight: 1.65, color: METIN, minHeight: 28, whiteSpace: 'pre-wrap' },
  araBaslik: { fontFamily: yazi.baslik, fontSize: 22, lineHeight: 1.2, letterSpacing: '-0.02em', color: yRenk.metin, minHeight: 26 },
  ipucu: { padding: '12px 14px', borderRadius: 16, background: yRenk.bekliyorZemin, display: 'flex', flexDirection: 'column', gap: 4 },
  ipucuEtiket: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: '0.06em', color: yRenk.bekliyorMetin },
  ipucuMetin: { fontFamily: yazi.normal, fontSize: 15, lineHeight: 1.5, color: yRenk.metin, minHeight: 22 },
  liste: { margin: 0, paddingLeft: 22, fontFamily: yazi.normal, fontSize: 17, lineHeight: 1.65, color: METIN },
  foto: { position: 'relative', height: 200, borderRadius: 16, background: '#ffe2cc', overflow: 'hidden', display: 'flex', gap: 4 },
  fotoGorsel: { flex: 1, minWidth: 0, height: '100%', objectFit: 'cover', display: 'block' },
  fotoDegistir: { position: 'absolute', right: 12, top: 12, height: 28, padding: '0 10px', border: 0, borderRadius: 8, background: yRenk.zemin, color: yRenk.metin, fontFamily: yazi.ekstra, fontSize: 12, cursor: 'pointer' },
  altyazi: { marginTop: 6, width: '100%', border: 0, outline: 'none', padding: 0, fontFamily: yazi.normal, fontSize: 13, color: yRenk.soluk, background: 'transparent' },
  kart: { position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, border: `1.5px solid ${yRenk.ayrac}`, cursor: 'pointer', userSelect: 'none' },
  kartSecili: { border: `2px solid ${yRenk.ana}`, padding: 9.5 },
  kartKare: { width: 56, height: 56, flexShrink: 0, borderRadius: 14, overflow: 'hidden', background: yRenk.yuzey },
  kartFoto: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  kartMetin: { flex: 1, minWidth: 0 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 15, color: yRenk.metin },
  kartAlt: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  kartArti: { width: 38, height: 38, borderRadius: 11, background: yRenk.vurgu, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  blokArac: { position: 'absolute', right: 8, top: -18, zIndex: 4, display: 'flex', gap: 2, padding: 3, borderRadius: 10, background: yRenk.metin },
  aracDugme: { height: 28, padding: '0 8px', border: 0, borderRadius: 7, background: 'transparent', color: yRenk.zemin, fontFamily: yazi.ekstra, fontSize: 12, cursor: 'pointer' },
  slash: { position: 'absolute', left: 0, top: 34, zIndex: 5, width: 300, padding: 8, borderRadius: 16, background: yRenk.zemin, boxShadow: '0 16px 40px rgba(14,20,48,0.18)', display: 'flex', flexDirection: 'column', gap: 2 },
  slashBaslik: { fontFamily: yazi.ekstra, fontSize: 11, letterSpacing: '0.06em', color: yRenk.ikincil, padding: '4px 8px 6px' },
  slashSecenek: { display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer' },
  slashSecili: { background: yRenk.yuzey },
  slashKare: { width: 32, height: 32, flexShrink: 0, borderRadius: 9, background: yRenk.yuzey, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 },
  slashAd: { display: 'block', fontFamily: yazi.ekstra, fontSize: 14, color: yRenk.metin },
  slashAlt: { display: 'block', fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  slashEnter: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  secimArac: { position: 'absolute', zIndex: 6, display: 'flex', gap: 2, padding: 4, borderRadius: 12, background: yRenk.metin },
  secimDugme: { width: 32, height: 32, border: 0, borderRadius: 8, background: 'transparent', color: yRenk.zemin, fontFamily: yazi.ekstra, fontSize: 13, cursor: 'pointer' },
  baglaKutusu: { position: 'relative' },
};
