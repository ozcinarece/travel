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

/** Sunucu "taslak başka yerde değişti" dediğinde (eski sekme ya da ikinci kişi): PostgreSQL serialization_failure. */
export const cakismaMi = (e: unknown) => !!e && typeof e === 'object' && (e as { code?: unknown }).code === '40001';

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
  const [cakisma, setCakismaDurumu] = useState(false);
  const cakismaVar = useRef(false);
  const setCakisma = (v: boolean) => {
    cakismaVar.current = v;
    setCakismaDurumu(v);
  };
  // Taslak zamanları: kayıttan sonra yerel, yayından sonra sunucudan.
  const [zamanYerel, setZamanYerel] = useState<{ updated_at: string; yayinlandi_at: string | null } | null>(null);
  const t = taslakQ.data;
  const zaman = zamanYerel ?? (t ? { updated_at: t.updated_at, yayinlandi_at: t.yayinlandi_at } : null);
  const [silinen, setSilinen] = useState<Silinen | null>(null);
  const son = useRef<TaslakBolum[] | null>(null);
  const yeniBilinen = useRef<Record<string, BilinenMekan>>({});
  const kirli = useRef(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Düzenlemenin dayandığı taslak damgası (sunucu metni, mikrosaniyeli; Date'e çevrilmez). undefined = henüz alınmadı.
  const taban = useRef<string | null | undefined>(undefined);
  // Süren kayıt: kayıtlar sırayla gider, Yayınla bunu bekler.
  const suren = useRef<Promise<boolean>>(Promise.resolve(true));
  // Render'da okunan değerler, kararlı `yaz` için.
  const guncel = useRef({ ilk, taslak: t });
  useEffect(() => {
    guncel.current = { ilk, taslak: t };
  });
  const tabanAl = () => (taban.current !== undefined ? taban.current : (guncel.current.taslak?.updated_at ?? null));

  /**
   * Bekleyen taslağı yazar; `true` = sunucu güncel. Yazılacak bir şey yoksa da `true`.
   * neden 'silme' / 'donus' ya da `zorla` her zaman yazar (sunucu güncellemeden önceki hâli Geçmiş'e koyar).
   */
  const yaz = useCallback(
    (neden: 'kayit' | 'silme' | 'donus' = 'kayit', zorla = false): Promise<boolean> => {
      const is = suren.current.then(async () => {
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        zamanlayici.current = null;
        // Çakışmadan sonra "Yeniden yükle"ye kadar yazılmaz (eski hâl yeni taslağın üstüne gitmesin).
        if (cakismaVar.current) return false;
        const b = son.current ?? guncel.current.ilk;
        if (!b) return true;
        if (!kirli.current && !zorla && neden === 'kayit') return true;
        kirli.current = false;
        setDurum((d) => ({ ...d, kaydediliyor: true, hata: false }));
        try {
          const updated_at = await rehberTaslakKaydet(sehirId, b, yeniBilinen.current, neden, tabanAl());
          taban.current = updated_at;
          yeniBilinen.current = {};
          setZamanYerel((z) => ({ updated_at, yayinlandi_at: z?.yayinlandi_at ?? guncel.current.taslak?.yayinlandi_at ?? null }));
          setDurum({ kaydedildi: new Date(), kaydediliyor: false, hata: false });
          void qc.invalidateQueries({ queryKey: surumAnahtari(sehirId) });
          return true;
        } catch (e) {
          kirli.current = true;
          if (cakismaMi(e)) {
            cakismaVar.current = true;
            setCakismaDurumu(true);
          }
          setDurum((d) => ({ ...d, kaydediliyor: false, hata: true }));
          return false;
        }
      });
      suren.current = is;
      return is;
    },
    [qc, sehirId],
  );
  // Ayrılırken bekleyen kayıt yazılır.
  useEffect(() => () => void yaz(), [yaz]);

  const degistir = useCallback(
    (f: (b: TaslakBolum[]) => TaslakBolum[], kaydet = true) => {
      const once = son.current ?? guncel.current.ilk;
      if (!once) return;
      // İlk değişiklik: o an görülen taslağın damgası taban olur (sonra gelen başka sekme kaydı üstüne yazılmasın).
      if (taban.current === undefined) taban.current = guncel.current.taslak?.updated_at ?? null;
      const yeni = f(once);
      son.current = yeni;
      kirli.current = true;
      setYerel(yeni);
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = kaydet ? setTimeout(() => void yaz(), bekleme) : null;
    },
    [yaz, bekleme],
  );

  /** Sunucu taslağı yoksa önce oluşturur, varsa bekleyeni yazar: silme / dönüş öncesi hâl Geçmiş'e girsin. */
  const sunucuyuGuncelle = () => yaz('kayit', tabanAl() === null);

  /** Çakışmada "Yeniden yükle": yerel değişiklikler bırakılır, sunucudaki taslak okunur. */
  const yenidenYukle = async () => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = null;
    await suren.current;
    kirli.current = false;
    son.current = null;
    taban.current = undefined;
    yeniBilinen.current = {};
    setYerel(null);
    setZamanYerel(null);
    setSilinen(null);
    setCakisma(false);
    setDurum({ kaydedildi: null, kaydediliyor: false, hata: false });
    await Promise.all([taslakQ.refetch(), canli.refetch()]);
  };

  const bolumGuncelle = (id: string, alan: Partial<TaslakBolum>) => degistir((b) => b.map((x) => (x.id === id ? { ...x, ...alan } : x)));

  return {
    yukleniyor: !bolumler && (canli.isPending || taslakQ.isPending),
    hata: canli.isError || taslakQ.isError,
    bolumler: bolumler ?? [],
    seciliId,
    sec: setSecili,
    // Açılışta "Kaydedildi" saati taslağın kendisinden.
    durum: { ...durum, kaydedildi: durum.kaydedildi ?? (zaman ? new Date(zaman.updated_at) : null) },
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
    /** Sil: silinmemiş hâl Geçmiş'e girer ("Silmeden önce"); bildirimde Geri al. */
    sil: async (id: string) => {
      if (!(await sunucuyuGuncelle())) return;
      const once = son.current ?? guncel.current.ilk;
      if (!once) return;
      const { kalan, silinen: s } = bolumSil(once, id);
      if (!s) return;
      degistir(() => kalan, false);
      setSilinen({ ...s, kart: bolumKartSayisi(s.bolum) });
      if (seciliId === id) setSecili(kalan[Math.max(0, s.indeks - 1)]?.id ?? KAPAK_OZET);
      await yaz('silme');
    },
    geriAl: () => {
      if (!silinen) return;
      degistir((x) => bolumGeriAl(x, silinen));
      setSecili(silinen.bolum.id);
      setSilinen(null);
    },
    bildirimKapat: () => setSilinen(null),
    /** Geçmiş: şimdiki hâl sürüm olarak yazılır ("Dönüşten önce"), sonra seçilen sürüme dönülür. */
    surumeDon: async (s: RehberSurumu) => {
      if (!(await sunucuyuGuncelle())) return;
      degistir(() => s.bolumler, false);
      if (!s.bolumler.some((b) => b.id === seciliId)) setSecili(s.bolumler[0]?.id ?? KAPAK_OZET);
      await yaz('donus');
    },
    simdiKaydet: () => yaz(),
    cakisma,
    yenidenYukle,
    /**
     * Yayınla: süren ve bekleyen kayıt beklenir (taslak yoksa oluşturulur); kayıt başarısızsa yayın yapılmaz.
     * Sunucu, editörün gördüğü taslağı yayınlar (başka yerde değiştiyse 40001). Döner: açılan taslak yer sayısı.
     */
    yayinla: async () => {
      if (!(await sunucuyuGuncelle())) throw new Error('kayit');
      try {
        const acilan = await rehberYayinla(sehirId, tabanAl()!);
        setZamanYerel(null);
        await Promise.all([
          qc.invalidateQueries({ queryKey: rehberAnahtari(sehirId) }),
          qc.invalidateQueries({ queryKey: taslakAnahtari(sehirId) }),
          qc.invalidateQueries({ queryKey: ['icerik', 'rehber', sehirId] }),
        ]);
        return acilan;
      } catch (e) {
        if (cakismaMi(e)) setCakisma(true);
        throw e;
      }
    },
  };
}

export type RehberYazari = ReturnType<typeof useRehberYazari>;
