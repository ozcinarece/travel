// #184 Sohbet (kanvas 26): saf hesaplar — zaman çizelgesi (tarih ayraçları + mesajlar + gri sistem satırları), sistem satırı
// birleştirme (aynı kişinin 2 dk içindeki değişiklikleri tek satır), oylama özeti, "okundu", saat / kapanış metinleri.
import type { DegisiklikGrubu } from '@/features/program/degisiklikMetni';
import { AYLAR_KISA, GUNLER_KISA, haftaGunu, parcala, tarihEkle } from '@/lib/takvim';
import { saatEkli, yerelSaatDk, yerelTarih } from '@/lib/zaman';

export type MesajTuru = 'metin' | 'mekan' | 'oylama' | 'foto';

export type Mesaj = {
  id: string;
  trip_id: string;
  user_id: string | null;
  tur: MesajTuru;
  metin: string;
  place_id: string | null;
  oylama_id: string | null;
  foto_yolu: string | null;
  created_at: string;
  silindi_at: string | null;
};

export type OylamaSecenegi = { id: string; oylama_id: string; sira: number; metin: string; place_id: string | null };
export type OylamaOyu = { secenek_id: string; user_id: string };
export type Oylama = {
  id: string;
  trip_id: string;
  soru: string;
  kapanis_at: string | null;
  olusturan: string | null;
  created_at: string;
  oylama_secenekleri: OylamaSecenegi[];
  oylama_oylari: OylamaOyu[];
};

export type MesajOkuma = { user_id: string; son_okunan_at: string };

// ---------------------------------------------------------------- sistem satırları

/** KK4: gri, ortalı satır — bir ya da birkaç değişiklik grubu (aynı kişi, 2 dk içinde). `gruplar` yeniden eskiye. */
export type SistemSatiri = { id: string; kim: string | null; at: string; gruplar: DegisiklikGrubu[] };

export const SISTEM_PENCERESI_MS = 2 * 60 * 1000;

/**
 * Değişiklik grupları (yeniden eskiye, degisiklikGruplari çıktısı) → sistem satırları: aynı kişinin art arda gelen ve satırın
 * en yeni değişikliğinden en çok 2 dk önceki grupları tek satırda toplanır.
 */
export function sistemSatirlari(gruplar: DegisiklikGrubu[], pencereMs = SISTEM_PENCERESI_MS): SistemSatiri[] {
  const satirlar: SistemSatiri[] = [];
  for (const g of gruplar) {
    const son = satirlar[satirlar.length - 1];
    if (son && son.kim === g.kim && Date.parse(son.at) - Date.parse(g.at) <= pencereMs) son.gruplar.push(g);
    else satirlar.push({ id: `s${g.id}`, kim: g.kim, at: g.at, gruplar: [g] });
  }
  return satirlar;
}

// ---------------------------------------------------------------- zaman çizelgesi

export type CizelgeOgesi =
  | { tur: 'ayrac'; anahtar: string; tarih: string }
  | { tur: 'mesaj'; anahtar: string; mesaj: Mesaj }
  | { tur: 'sistem'; anahtar: string; satir: SistemSatiri };

/** Mesajlar ve sistem satırları zamana göre (eskiden yeniye) dizilir; her yeni takvim gününden önce ayraç gelir. */
export function zamanCizelgesi(mesajlar: Mesaj[], sistem: SistemSatiri[], tz: string): CizelgeOgesi[] {
  const ogeler = [
    ...mesajlar.map((m) => ({ at: m.created_at, oge: { tur: 'mesaj' as const, anahtar: `m${m.id}`, mesaj: m } })),
    ...sistem.map((s) => ({ at: s.at, oge: { tur: 'sistem' as const, anahtar: s.id, satir: s } })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const sonuc: CizelgeOgesi[] = [];
  let gun = '';
  for (const { at, oge } of ogeler) {
    const t = yerelTarih(new Date(at), tz);
    if (t !== gun) {
      gun = t;
      sonuc.push({ tur: 'ayrac', anahtar: `a${t}`, tarih: t });
    }
    sonuc.push(oge);
  }
  return sonuc;
}

/** "Bugün", "Dün", "Cum 16 Eki". */
export function tarihEtiketi(tarih: string, bugun: string, metin: { bugun: string; dun: string }): string {
  if (tarih === bugun) return metin.bugun;
  if (tarih === tarihEkle(bugun, -1)) return metin.dun;
  const p = parcala(tarih);
  return `${GUNLER_KISA[haftaGunu(tarih)]} ${p.gun} ${AYLAR_KISA[p.ay - 1]}`;
}

/** "18:40" (seyahat saat dilimi). */
export function saatMetni(iso: string, tz: string): string {
  const dk = yerelSaatDk(new Date(iso), tz);
  return `${String(Math.floor(dk / 60)).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- okundu

/** KK1: kendi mesajım diğer herkesin son okumasından önceyse "okundu" (tek kişilik seyahatte hiç). */
export function okunduMu(mesaj: Pick<Mesaj, 'created_at'>, okumalar: MesajOkuma[], uyeIdleri: string[], benId: string | null): boolean {
  const digerleri = uyeIdleri.filter((id) => id !== benId);
  if (digerleri.length === 0) return false;
  const son = new Map(okumalar.map((o) => [o.user_id, o.son_okunan_at]));
  return digerleri.every((id) => {
    const at = son.get(id);
    return !!at && at >= mesaj.created_at;
  });
}

// ---------------------------------------------------------------- oylama

export type OylamaOzeti = {
  secenekler: { secenek: OylamaSecenegi; oy: number; oran: number; oyVerenler: string[] }[];
  toplam: number;
  /** En çok oyu tek başına alan seçenek (oy > 0); berabere ya da oy yoksa null. */
  kazanan: OylamaSecenegi | null;
  oyVermeyenler: string[];
  kapali: boolean;
  benimOyum: string | null;
};

export function oylamaOzeti(o: Oylama, uyeIdleri: string[], benId: string | null, an: Date): OylamaOzeti {
  const secenekler = [...o.oylama_secenekleri].sort((a, b) => a.sira - b.sira);
  const toplam = o.oylama_oylari.length;
  const satirlar = secenekler.map((secenek) => {
    const oyVerenler = o.oylama_oylari.filter((v) => v.secenek_id === secenek.id).map((v) => v.user_id);
    return { secenek, oy: oyVerenler.length, oran: toplam ? oyVerenler.length / toplam : 0, oyVerenler };
  });
  const enCok = Math.max(0, ...satirlar.map((x) => x.oy));
  const enCoklar = satirlar.filter((x) => x.oy === enCok);
  const verenler = new Set(o.oylama_oylari.map((v) => v.user_id));
  return {
    secenekler: satirlar,
    toplam,
    kazanan: enCok > 0 && enCoklar.length === 1 ? enCoklar[0].secenek : null,
    oyVermeyenler: uyeIdleri.filter((id) => !verenler.has(id)),
    kapali: !!o.kapanis_at && Date.parse(o.kapanis_at) <= an.getTime(),
    benimOyum: o.oylama_oylari.find((v) => v.user_id === benId)?.secenek_id ?? null,
  };
}

/** Kapanış metni: "yarın 12:00'de kapanır", "bugün 20:00'de", "Cum 16 Eki 12:00'de"; geçtiyse null (kapandı). */
export function kapanisZamani(kapanis: string, an: Date, tz: string): { gun: 'bugun' | 'yarin' | 'tarih'; tarih: string; saat: string } | null {
  if (Date.parse(kapanis) <= an.getTime()) return null;
  const bugun = yerelTarih(an, tz);
  const tarih = yerelTarih(new Date(kapanis), tz);
  const saat = saatEkli(saatMetni(kapanis, tz), 'bulunma');
  return { gun: tarih === bugun ? 'bugun' : tarih === tarihEkle(bugun, 1) ? 'yarin' : 'tarih', tarih, saat };
}

/** KK3 kapanış seçenekleri (seyahat saat dilimi): 1 saat sonra, bu akşam 20:00 (geçtiyse yok), yarın 12:00. */
export function kapanisSecenekleri(an: Date, tz: string, yerelAn: (tarih: string, dk: number) => Date): { anahtar: 'saat' | 'aksam' | 'yarin'; an: Date }[] {
  const bugun = yerelTarih(an, tz);
  const aksam = yerelAn(bugun, 20 * 60);
  return [
    { anahtar: 'saat' as const, an: new Date(an.getTime() + 60 * 60 * 1000) },
    ...(aksam.getTime() - an.getTime() > 30 * 60 * 1000 ? [{ anahtar: 'aksam' as const, an: aksam }] : []),
    { anahtar: 'yarin' as const, an: yerelAn(tarihEkle(bugun, 1), 12 * 60) },
  ];
}

// ---------------------------------------------------------------- mekan kartı

/** KK2 "1. güne 9 dk": mekana en yakın durağın günü ve kuş uçuşu yürüyüş kestirimi (dk). Durak yoksa null. */
export function enYakinGun(
  konum: { lat: number; lng: number },
  duraklar: { gunIndex: number; konum: { lat: number; lng: number } }[],
  yuruyusSn: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
): { gunIndex: number; dk: number } | null {
  let en: { gunIndex: number; dk: number } | null = null;
  for (const d of duraklar) {
    const dk = Math.max(1, Math.round(yuruyusSn(konum, d.konum) / 60));
    if (!en || dk < en.dk) en = { gunIndex: d.gunIndex, dk };
  }
  return en;
}
