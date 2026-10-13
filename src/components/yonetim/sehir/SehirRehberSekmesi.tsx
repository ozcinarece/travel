import { useEffect, useState, type CSSProperties } from 'react';

import { saatMetni } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { rehberMekanSayisi } from '@/features/yonetim/rehberTaslak';
import { cakismaMi, KAPAK_OZET, useRehberYazari } from '@/features/yonetim/rehberYazari';
import type { SehirAlanlari } from '@/features/yonetim/sehir';
import type { Merkez } from '@/features/yerler/api';
import { icerikFotoUrl } from '@/lib/markdown';
import { yazi } from '@/theme';

import { DurumRozeti } from '../Form';
import { Hap } from '../Hap';
import { YonetimSayfasi } from '../Kabuk';
import { Bildirim, KayitDurumu, Rozet, type SekmeTanimi } from '../Ortak';
import { BolumListesi } from '../rehber/BolumListesi';
import { GecmisMenusu } from '../rehber/GecmisMenusu';
import { RehberKagidi } from '../rehber/RehberKagidi';
import { RehberOnizlemesi } from '../rehber/RehberOnizlemesi';
import { yRenk } from '../tema';

type Props = {
  sehirId: string;
  sehir: SehirAlanlari;
  sekmeler: SekmeTanimi<string>;
  merkez: Merkez;
  fotoYukle: (dosya: File) => Promise<string>;
  onOzet: (ozet: string | null) => void;
  onFotolar: () => void;
};

/** Silme bildirimi ekranda kalma süresi (KK9: ≥ 8 sn). */
const BILDIRIM_MS = 10_000;

/**
 * #156 şehir rehberi sekmesi (kanvas BO-1 / BO-2): başlıkta "Taslak değişiklik var", kayıt durumu, Geçmiş, Yayınla;
 * solda bölümler (Kapak ve özet + serbest bölümler), ortada WYSIWYG kâğıt, sağda uygulamanın kendisiyle önizleme;
 * silmede altta "… silindi · içindeki N mekan kartıyla · Geri al".
 */
export function SehirRehberSekmesi({ sehirId, sehir, sekmeler, merkez, fotoYukle, onOzet, onFotolar }: Props) {
  const y = useRehberYazari(sehirId);
  const [hata, setHata] = useState<string | null>(null);
  const [onizlemeAcik, setOnizlemeAcik] = useState(true);
  const [yayinMesgul, setYayinMesgul] = useState(false);
  const { silinen, bildirimKapat } = y;
  useEffect(() => {
    if (!silinen) return;
    const t = setTimeout(bildirimKapat, BILDIRIM_MS);
    return () => clearTimeout(t);
  }, [silinen, bildirimKapat]);

  const i = y.bolumler.findIndex((b) => b.id === y.seciliId);
  const bolum = i >= 0 ? y.bolumler[i] : undefined;
  const kayitMetni = y.durum.kaydediliyor
    ? ty('rehberEditor.kaydediliyor')
    : y.durum.hata
      ? ty('rehberEditor.kayitHata')
      : y.durum.kaydedildi
        ? ty('rehberEditor.kaydedildi', { saat: saatMetni(y.durum.kaydedildi) })
        : null;
  const yayinla = async () => {
    setYayinMesgul(true);
    setHata(null);
    try {
      await y.yayinla();
    } catch (e) {
      // Çakışmada ayrı uyarı (Yeniden yükle) görünür.
      if (!cakismaMi(e)) setHata(ty('rehberEditor.yayinHata'));
    } finally {
      setYayinMesgul(false);
    }
  };

  return (
    <YonetimSayfasi
      sutunlu
      baslik={sehir.ad}
      kapak={sehir.kapak_url}
      rozet={
        y.taslakVar ? (
          <Rozet tur="bekliyor" etiket={ty('rehberEditor.taslakVar')} />
        ) : (
          <DurumRozeti durum={sehir.yayin ? 'yayinda' : 'taslak'} etiket={ty(sehir.yayin ? 'sehir.durum.yayinda' : 'sehir.durum.taslak')} />
        )
      }
      durum={kayitMetni ? <KayitDurumu metin={kayitMetni} hata={y.durum.hata} /> : null}
      sekmeler={sekmeler}
      eylemler={
        <>
          <GecmisMenusu sehirId={sehirId} onDon={(s) => void y.surumeDon(s)} />
          <Hap tur="vurgu" baslik={ty('gezi.yayinla')} onPress={() => void yayinla()} yukleniyor={yayinMesgul} />
        </>
      }>
      <BolumListesi
        bolumler={y.bolumler}
        seciliId={y.seciliId}
        mekanSayisi={rehberMekanSayisi(y.bolumler)}
        onSec={y.sec}
        onEkle={() => y.ekle(ty('rehberEditor.yeniBolum'))}
        onAdlandir={(id, baslik) => y.bolumGuncelle(id, { baslik })}
        onCogalt={(id) => y.cogalt(id, ty('rehberEditor.kopya'))}
        onGizle={(id, gizli) => y.bolumGuncelle(id, { gizli })}
        onTasi={y.tasi}
        onYerlestir={y.yerlestir}
        onSil={(id) => void y.sil(id)}
      />
      <div style={c.orta}>
        <div style={c.kaydir}>
          {y.cakisma ? (
            <div role="alert" style={c.cakisma}>
              <span>{ty('rehberEditor.cakisma')}</span>
              <Hap kucuk tur="birincil" baslik={ty('rehberEditor.yenidenYukle')} onPress={() => void y.yenidenYukle()} />
            </div>
          ) : null}
          {hata ? (
            <button type="button" onClick={() => setHata(null)} style={c.hata}>
              {hata}
            </button>
          ) : null}
          {y.yukleniyor || y.hata ? (
            <div style={c.bilgi}>{ty(y.hata ? 'rehberEditor.yuklenemedi' : 'rehberEditor.yukleniyor')}</div>
          ) : y.seciliId === KAPAK_OZET || !bolum ? (
            <KapakOzet sehir={sehir} onOzet={onOzet} onFotolar={onFotolar} />
          ) : (
            <RehberKagidi
              bolum={bolum}
              no={i + 1}
              bolumler={y.bolumler}
              merkez={merkez}
              fotoYukle={fotoYukle}
              onHata={setHata}
              onMekanSecildi={y.mekanSecildi}
              bilinen={y.bilinen}
              onDegis={(alan) => y.bolumGuncelle(bolum.id, alan)}
            />
          )}
        </div>
        {silinen ? (
          <Bildirim
            metin={silinen.kart ? ty('rehberEditor.silindiMekan', { ad: silinen.bolum.baslik, n: silinen.kart }) : ty('rehberEditor.silindi', { ad: silinen.bolum.baslik })}
            eylem={ty('rehberEditor.geriAl')}
            onEylem={y.geriAl}
          />
        ) : null}
      </div>
      <RehberOnizlemesi
        sehir={{ id: sehirId, ad: sehir.ad, slug: sehir.slug, kapak_url: sehir.kapak_url, lat: sehir.lat, lng: sehir.lng, ozet: sehir.ozet }}
        bolumler={y.bolumler}
        bilinen={y.bilinen}
        seciliId={y.seciliId}
        acik={onizlemeAcik}
        onAcik={setOnizlemeAcik}
      />
    </YonetimSayfasi>
  );
}

/** "Kapak ve özet" (KK10): rehber sayfasının başı — geniş kapak ve şehir özeti. Kanvasta bu durumun çizimi yok. */
function KapakOzet({ sehir, onOzet, onFotolar }: { sehir: SehirAlanlari; onOzet: (ozet: string | null) => void; onFotolar: () => void }) {
  const kapak = sehir.genis_kapak_url ?? sehir.kapak_url;
  return (
    <div style={c.kagit}>
      <div style={c.etiket}>{ty('rehberEditor.kapak.etiket')}</div>
      <div style={c.kapak}>
        {kapak ? <img src={kapak.startsWith('http') ? kapak : icerikFotoUrl(kapak)} alt="" style={c.kapakGorsel} /> : <span style={c.kapakYok}>{ty('rehberEditor.kapak.kapakYok')}</span>}
        <button type="button" onClick={onFotolar} style={c.kapakDugme}>
          {ty('rehberEditor.kapak.fotolar')}
        </button>
      </div>
      <textarea
        value={sehir.ozet ?? ''}
        maxLength={400}
        rows={3}
        aria-label={ty('rehberEditor.kapak.ozet')}
        placeholder={ty('rehberEditor.kapak.ozet')}
        onChange={(e) => onOzet(e.target.value || null)}
        style={c.ozet}
      />
    </div>
  );
}

const c: Record<string, CSSProperties> = {
  orta: { flex: 1, minWidth: 0, position: 'relative', display: 'flex' },
  kaydir: { flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 },
  hata: { alignSelf: 'center', border: 0, borderRadius: 10, padding: '8px 12px', background: yRenk.hataZemin, color: yRenk.hata, fontFamily: yazi.yari, fontSize: 13, cursor: 'pointer' },
  cakisma: { alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, padding: '8px 8px 8px 14px', background: yRenk.hataZemin, color: yRenk.hata, fontFamily: yazi.yari, fontSize: 13 },
  bilgi: { fontFamily: yazi.normal, fontSize: 13, color: yRenk.ikincil },
  kagit: { width: '100%', maxWidth: 620, margin: '0 auto', flexGrow: 1, flexShrink: 0, background: yRenk.zemin, borderRadius: 24, boxShadow: '0 10px 30px rgba(21,42,107,0.08)', padding: '34px 44px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: '0.08em', color: yRenk.ikincil },
  kapak: { position: 'relative', height: 220, borderRadius: 16, background: '#ffe2cc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  kapakGorsel: { width: '100%', height: '100%', objectFit: 'cover' },
  kapakYok: { fontFamily: yazi.yari, fontSize: 13, color: yRenk.ikincil },
  kapakDugme: { position: 'absolute', right: 12, top: 12, height: 28, padding: '0 10px', border: 0, borderRadius: 8, background: yRenk.zemin, color: yRenk.metin, fontFamily: yazi.ekstra, fontSize: 12, cursor: 'pointer' },
  ozet: { border: 0, outline: 'none', resize: 'vertical', padding: 0, fontFamily: yazi.normal, fontSize: 17, lineHeight: 1.65, color: '#232b48', background: 'transparent' },
};
