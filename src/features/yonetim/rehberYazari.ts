// #156 KK7–13: şehir rehberi editörünün durumu — taslak (2 sn'de bir otomatik kayıt), bölüm işlemleri, sil + geri al,
// Geçmiş'ten dönüş, Yayınla. Canlı bölümler yalnız Yayınla ile değişir.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { HafifYer } from '@/features/yerler/api';

import {
  bolumCogalt,
  bolumGeriAl,
  bolumSil,
  bolumTasi,
  bolumKartSayisi,
  canlidanTaslak,
  taslakDegisti,
  yeniBolum,
  type BilinenMekan,
  type TaslakBolum,
} from './rehberTaslak';
import { rehberAnahtari, rehberTaslakKaydet, rehberYayinla, surumAnahtari, taslakAnahtari, useRehberBolumleri, useRehberTaslagi, type RehberSurumu } from './sehirSorgulari';

export const KAPAK_OZET = 'kapak';
export type Silinen = { bolum: TaslakBolum; indeks: number; kart: number };
type Durum = { kaydedildi: Date | null; kaydediliyor: boolean; hata: boolean };

const yeniKimlik = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

export function useRehberYazari(sehirId: string, bekleme = 2000) {
  const qc = useQueryClient();
  const canli = useRehberBolumleri(sehirId);
  const taslakQ = useRehberTaslagi(sehirId);
  // Yerel taslak ilk değişiklikte oluşur; o zamana kadar sunucudaki taslak, yoksa canlı bölümler.
  const [yerel, setYerel] = useState<TaslakBolum[] | null>(null);
  const ilk = useMemo(
    () => (taslakQ.isSuccess && canli.isSuccess ? (taslakQ.data?.bolumler ?? canlidanTaslak(canli.data)) : null),
    [taslakQ.isSuccess, taslakQ.data, canli.isSuccess, canli.data],
  );
  const bolumler = yerel ?? ilk;
  const [secili, setSecili] = useState<string | null>(null);
  const seciliId = secili ?? bolumler?.[0]?.id ?? KAPAK_OZET;
  const [durum, setDurum] = useState<Durum>({ kaydedildi: null, kaydediliyor: false, hata: false });
  // Taslak zamanları: kayıttan sonra yerel, yayından sonra sunucudan.
  const [zamanYerel, setZamanYerel] = useState<{ updated_at: string; yayinlandi_at: string | null } | null>(null);
  const t = taslakQ.data;
  const zaman = zamanYerel ?? (t ? { updated_at: t.updated_at, yayinlandi_at: t.yayinlandi_at } : null);
  const [silinen, setSilinen] = useState<Silinen | null>(null);
  const son = useRef<TaslakBolum[] | null>(null);
  const yeniBilinen = useRef<Record<string, BilinenMekan>>({});
  const kirli = useRef(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yaz = useCallback(
    async (neden: 'kayit' | 'silme' | 'donus' = 'kayit', yazilacak?: TaslakBolum[]) => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = null;
      const b = yazilacak ?? son.current ?? ilk;
      if (!b || (!kirli.current && !yazilacak)) return;
      if (!yazilacak) kirli.current = false;
      setDurum((d) => ({ ...d, kaydediliyor: true, hata: false }));
      try {
        const updated_at = await rehberTaslakKaydet(sehirId, b, yeniBilinen.current, neden);
        yeniBilinen.current = {};
        setZamanYerel((z) => ({ updated_at, yayinlandi_at: z?.yayinlandi_at ?? taslakQ.data?.yayinlandi_at ?? null }));
        setDurum({ kaydedildi: new Date(), kaydediliyor: false, hata: false });
        void qc.invalidateQueries({ queryKey: surumAnahtari(sehirId) });
      } catch {
        if (!yazilacak) kirli.current = true;
        setDurum((d) => ({ ...d, kaydediliyor: false, hata: true }));
      }
    },
    [qc, sehirId, ilk, taslakQ.data?.yayinlandi_at],
  );
  // Ayrılırken bekleyen kayıt yazılır.
  useEffect(() => () => void yaz(), [yaz]);

  const degistir = useCallback(
    (f: (b: TaslakBolum[]) => TaslakBolum[]) => {
      const once = son.current ?? ilk;
      if (!once) return;
      const yeni = f(once);
      son.current = yeni;
      kirli.current = true;
      setYerel(yeni);
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = setTimeout(() => void yaz(), bekleme);
    },
    [yaz, bekleme, ilk],
  );

  const bolumGuncelle = (id: string, alan: Partial<TaslakBolum>) => degistir((b) => b.map((x) => (x.id === id ? { ...x, ...alan } : x)));

  return {
    yukleniyor: !bolumler && (canli.isPending || taslakQ.isPending),
    hata: canli.isError || taslakQ.isError,
    bolumler: bolumler ?? [],
    seciliId,
    sec: setSecili,
    durum,
    taslakVar: taslakDegisti(zaman),
    silinen,
    bolumGuncelle,
    mekanSecildi: (y: HafifYer) => {
      yeniBilinen.current[y.place_id] = { ad: y.ad, kategori: y.primary_type, lat: y.lat, lng: y.lng };
    },
    ekle: (baslik: string) => {
      const b = yeniBolum(yeniKimlik(), baslik);
      degistir((x) => [...x, b]);
      setSecili(b.id);
    },
    cogalt: (id: string, ek: string) => {
      const yeniId = yeniKimlik();
      degistir((x) => bolumCogalt(x, id, yeniId, ek));
      setSecili(yeniId);
    },
    tasi: (id: string, yon: -1 | 1) => degistir((x) => bolumTasi(x, id, yon)),
    yerlestir: (yeni: TaslakBolum[]) => degistir(() => yeni),
    /** Sil: önce silinmemiş hâl Geçmiş'e yazılır; bildirimde Geri al. */
    sil: async (id: string) => {
      const once = son.current ?? ilk;
      if (!once) return;
      await yaz('silme', once);
      const { kalan, silinen: s } = bolumSil(once, id);
      if (!s) return;
      degistir(() => kalan);
      setSilinen({ ...s, kart: bolumKartSayisi(s.bolum) });
      if (seciliId === id) setSecili(kalan[Math.max(0, s.indeks - 1)]?.id ?? KAPAK_OZET);
    },
    geriAl: () => {
      if (!silinen) return;
      degistir((x) => bolumGeriAl(x, silinen));
      setSecili(silinen.bolum.id);
      setSilinen(null);
    },
    bildirimKapat: () => setSilinen(null),
    /** Geçmiş: şimdiki hâl sürüm olarak yazılır, sonra seçilen sürüme dönülür. */
    surumeDon: async (s: RehberSurumu) => {
      const once = son.current ?? ilk;
      if (once) await yaz('donus', once);
      degistir(() => s.bolumler);
      if (!s.bolumler.some((b) => b.id === seciliId)) setSecili(s.bolumler[0]?.id ?? KAPAK_OZET);
    },
    simdiKaydet: () => yaz(),
    /** Yayınla: bekleyen kayıt yazılır, taslak canlıya geçer. Döner: açılan taslak yer sayısı. */
    yayinla: async () => {
      await yaz();
      const once = son.current ?? ilk;
      if (!zaman && once) await yaz('kayit', once);
      const acilan = await rehberYayinla(sehirId);
      setZamanYerel(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: rehberAnahtari(sehirId) }),
        qc.invalidateQueries({ queryKey: taslakAnahtari(sehirId) }),
        qc.invalidateQueries({ queryKey: ['icerik', 'rehber', sehirId] }),
      ]);
      return acilan;
    },
  };
}

export type RehberYazari = ReturnType<typeof useRehberYazari>;
