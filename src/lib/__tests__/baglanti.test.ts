// #243 KK3: bağlantı durumu sorgu sonuçlarından çıkarılır (NetInfo yok).
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { AccessibilityInfo, Platform } from "react-native";

import {
  agHatasi,
  baglantiyiIzle,
  baglantiyiSifirla,
  cevrimdisiMi,
  googleSorgusu,
} from "../baglanti";

const AG = {
  message: "TypeError: Network request failed",
  details: "",
  hint: "",
  code: "",
};

describe("ağ hatası sınıflandırması", () => {
  it("ulaşılamayan sunucu ağ hatasıdır; sunucunun döndüğü hata değildir", () => {
    expect(agHatasi(new TypeError("Network request failed"))).toBe(true);
    expect(agHatasi(AG)).toBe(true);
    expect(
      agHatasi(
        Object.assign(
          new Error("Failed to send a request to the Edge Function"),
          { name: "FunctionsFetchError" },
        ),
      ),
    ).toBe(true);
    expect(
      agHatasi({ message: "permission denied for table trips", code: "42501" }),
    ).toBe(false);
    expect(
      agHatasi(
        new TypeError("Cannot read properties of undefined (reading 'x')"),
      ),
    ).toBe(false);
    expect(agHatasi(null)).toBe(false);
  });
});

describe("baglantiyiIzle", () => {
  let birak: (() => void) | null = null;
  afterEach(() => {
    birak?.();
    birak = null;
    baglantiyiSifirla();
  });

  it("ilk ağ hatasında (yeniden denemeleri beklemeden) çevrimdışı; ağdan başarı gelince çevrimiçi ve sorgular yenilenir", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    let ag = false;
    const sorgu = () => (ag ? Promise.resolve("tamam") : Promise.reject(AG));
    await qc
      .fetchQuery({ queryKey: ["seyahat", "s1"], queryFn: sorgu })
      .catch(() => undefined);
    expect(cevrimdisiMi()).toBe(true);

    const yenile = jest.spyOn(qc, "invalidateQueries");
    ag = true;
    await qc.fetchQuery({ queryKey: ["profil", "u1"], queryFn: sorgu });
    // #293 KK2: tek başarı yetmez; ard arda ikinci başarıda çevrimiçi.
    expect(cevrimdisiMi()).toBe(true);
    await qc.fetchQuery({ queryKey: ["profil", "u2"], queryFn: sorgu });
    expect(cevrimdisiMi()).toBe(false);
    expect(yenile).toHaveBeenCalledTimes(1);
    qc.clear();
  });

  it("#293 KK7: iOS duyurusu çevrimdışına geçildiği anda tek yerden, bir kez yapılır", async () => {
    const duyur = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
    try {
      expect(Platform.OS).toBe("ios");
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
      const dus = (k: string) =>
        qc
          .fetchQuery({ queryKey: [k], queryFn: () => Promise.reject(AG) })
          .catch(() => undefined);
      // Gezi ve Sohbet aynı anda açıkken iki sorgu düşer: duyuru yine bir kez.
      // Önceki testlerden kalan işler bitsin; sayım temiz başlasın.
      await new Promise((r) => setTimeout(r, 0));
      baglantiyiSifirla();
      duyur.mockClear();
      await dus("seyahat");
      await dus("mesajlar");
      expect(duyur).toHaveBeenCalledTimes(1);
      expect(duyur).toHaveBeenCalledWith(
        "Çevrimdışı. Plan okunur; bağlanınca kendiliğinden yenilenir",
      );
      // Çevrimiçine dönüşte duyuru yok; yeniden kopunca bir kez daha.
      for (const k of ["profil-a", "profil-b"])
        await qc.fetchQuery({ queryKey: [k], queryFn: () => Promise.resolve(1) });
      expect(cevrimdisiMi()).toBe(false);
      expect(duyur).toHaveBeenCalledTimes(1);
      await dus("seyahat-2");
      expect(duyur).toHaveBeenCalledTimes(2);
      qc.clear();
    } finally {
      duyur.mockRestore();
    }
  });

  it("bağlantı dönünce yalnız bizim sorgularımız yenilenir; Google sorguları (Edge Function) yeniden gitmez", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    const gozlemciler = [
      ["seyahat", "s1"],
      ["tam-yer", "p1"],
      ["mekan-ozeti", "p1"],
      ["place-foto", "p1"],
      ["yorumlar", "p1"],
    ].map((k) => {
      const fn = jest.fn(() => Promise.resolve("veri"));
      const o = new QueryObserver(qc, { queryKey: k, queryFn: fn });
      const b = o.subscribe(() => undefined);
      return { k, fn, b };
    });
    try {
      await new Promise((r) => setTimeout(r, 0));
      for (const g of gozlemciler) expect(g.fn).toHaveBeenCalledTimes(1);

      await qc
        .fetchQuery({ queryKey: ["x"], queryFn: () => Promise.reject(AG) })
        .catch(() => undefined);
      expect(cevrimdisiMi()).toBe(true);
      for (const u of ["u1", "u2"])
        await qc.fetchQuery({
          queryKey: ["profil", u],
          queryFn: () => Promise.resolve("tamam"),
        });
      expect(cevrimdisiMi()).toBe(false);
      await new Promise((r) => setTimeout(r, 0));

      const [seyahat, ...google] = gozlemciler;
      expect(seyahat.fn).toHaveBeenCalledTimes(2);
      for (const g of google) expect(g.fn).toHaveBeenCalledTimes(1);
    } finally {
      gozlemciler.forEach((g) => g.b());
      qc.clear();
    }
  });

  it("elle yazılan veri (setQueryData) ve sunucu hatası durumu değiştirmez", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    await qc
      .fetchQuery({
        queryKey: ["a"],
        queryFn: () =>
          Promise.reject({ message: "JWT expired", code: "PGRST301" }),
      })
      .catch(() => undefined);
    expect(cevrimdisiMi()).toBe(false);
    await qc
      .fetchQuery({ queryKey: ["b"], queryFn: () => Promise.reject(AG) })
      .catch(() => undefined);
    expect(cevrimdisiMi()).toBe(true);
    qc.setQueryData(["c"], 1);
    expect(cevrimdisiMi()).toBe(true);
    qc.clear();
  });

  it("başarısız işlem (mutation) ağ hatasıyla düşerse çevrimdışı", async () => {
    const qc = new QueryClient();
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    qc.getMutationCache().notify({
      type: "updated",
      mutation: {} as never,
      action: { type: "error", error: new TypeError("Network request failed") },
    } as never);
    expect(cevrimdisiMi()).toBe(true);
    qc.clear();
  });

  it("çevrimdışıyken profil sorgusu aralıkla yeniden denenir", () => {
    jest.useFakeTimers();
    const qc = new QueryClient();
    const yokla = jest.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
    birak = baglantiyiIzle(qc, { yoklamaMs: 1000 });
    qc.getQueryCache().notify({
      type: "updated",
      query: qc.getQueryCache().build(qc, { queryKey: ["x"] }),
      action: { type: "failed", failureCount: 1, error: AG },
    } as never);
    jest.advanceTimersByTime(2100);
    expect(yokla).toHaveBeenCalledWith({ queryKey: ["profil"] });
    expect(yokla.mock.calls.length).toBe(2);
    qc.clear();
    jest.useRealTimers();
  });

  const bildir = (qc: QueryClient, tur: "failed" | "success") =>
    qc.getQueryCache().notify({
      type: "updated",
      query: qc.getQueryCache().build(qc, { queryKey: ["x"] }),
      action:
        tur === "failed"
          ? { type: "failed", failureCount: 1, error: AG }
          : { type: "success", data: 1, dataUpdatedAt: Date.now() },
    } as never);

  it("#293 KK2: zayıf ağda (hata, başarı, hata, başarı) şerit bir kez açılır, en çok bir kez kapanır", () => {
    jest.useFakeTimers();
    try {
      const qc = new QueryClient();
      jest.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
      jest.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
      birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
      const gecisler: boolean[] = [];
      let onceki = cevrimdisiMi();
      const izle = () => {
        if (cevrimdisiMi() !== onceki) gecisler.push((onceki = cevrimdisiMi()));
      };
      for (const tur of ["failed", "success", "failed", "success"] as const) {
        bildir(qc, tur);
        izle();
        jest.advanceTimersByTime(1000);
        izle();
      }
      jest.advanceTimersByTime(5000);
      izle();
      expect(gecisler.filter((g) => g).length).toBe(1);
      expect(gecisler.filter((g) => !g).length).toBeLessThanOrEqual(1);
      expect(gecisler[0]).toBe(true);
      qc.clear();
    } finally {
      jest.useRealTimers();
    }
  });

  it("#293 KK2: tek başarıdan sonra 3 sn kesintisiz başarı (ağ hatası yok) çevrimiçine döndürür; arada gelen hata sayacı sıfırlar", () => {
    jest.useFakeTimers();
    try {
      const qc = new QueryClient();
      jest.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
      jest.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
      birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
      bildir(qc, "failed");
      bildir(qc, "success");
      jest.advanceTimersByTime(2900);
      expect(cevrimdisiMi()).toBe(true);
      jest.advanceTimersByTime(200);
      expect(cevrimdisiMi()).toBe(false);

      bildir(qc, "failed");
      bildir(qc, "success");
      jest.advanceTimersByTime(2000);
      bildir(qc, "failed");
      jest.advanceTimersByTime(5000);
      expect(cevrimdisiMi()).toBe(true);
      // Hatadan sonraki ilk başarı yetmez, ikincisi çevrimiçi yapar.
      bildir(qc, "success");
      expect(cevrimdisiMi()).toBe(true);
      bildir(qc, "success");
      expect(cevrimdisiMi()).toBe(false);
      qc.clear();
    } finally {
      jest.useRealTimers();
    }
  });

  it("#293 KK9: bağlantı dönünce Google'a gitmeyen bütün etkin sorgular (sohbet dahil) yenilenir; Google sorguları yenilenmez", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    birak = baglantiyiIzle(qc, { yoklamaMs: 60_000 });
    const bizim = [
      ["mesajlar", "s1"],
      ["oylamalar", "s1"],
      ["harcamalar", "s1"],
      ["seyahat", "s1"],
    ];
    const google = [
      ["hafif-yerler", "temel", "p1"],
      ["icerik", "gezi-rota", "g1", "a,b"],
      ["sehir-oneri", "ank", "o1", undefined, undefined],
      ["rota", "s1", "k", ""],
    ];
    const gozlemciler = [...bizim, ...google].map((k) => {
      const fn = jest.fn(() => Promise.resolve("veri"));
      const o = new QueryObserver(qc, { queryKey: k, queryFn: fn });
      const b = o.subscribe(() => undefined);
      return { k, fn, b };
    });
    try {
      await new Promise((r) => setTimeout(r, 0));
      await qc
        .fetchQuery({ queryKey: ["x"], queryFn: () => Promise.reject(AG) })
        .catch(() => undefined);
      for (const u of ["u1", "u2"])
        await qc.fetchQuery({
          queryKey: ["profil", u],
          queryFn: () => Promise.resolve("tamam"),
        });
      expect(cevrimdisiMi()).toBe(false);
      await new Promise((r) => setTimeout(r, 0));
      for (const g of gozlemciler.slice(0, bizim.length))
        expect(g.fn).toHaveBeenCalledTimes(2);
      for (const g of gozlemciler.slice(bizim.length))
        expect(g.fn).toHaveBeenCalledTimes(1);
    } finally {
      gozlemciler.forEach((g) => g.b());
      qc.clear();
    }
  });

  it("#293 KK9: Google sorgusu listesi bilinen Edge Function / Autocomplete anahtarlarını kapsar, bizimkileri kapsamaz", () => {
    for (const k of [
      ["tam-yer", "p"],
      ["mekan-ozeti", "p"],
      ["place-foto", "p"],
      ["yorumlar", "p"],
      ["onizleme", "x", "p"],
      ["hafif-yerler", "x"],
      ["yer-foto", "p"],
      ["icerik-canli", "foto", "a"],
      ["icerik", "gezi-rota", "g"],
      ["rota", "s"],
      ["yuruyus", "s"],
      ["sihirbaz-oneri", "a"],
      ["sihirbaz-rehber", "a"],
      ["sihirbaz", "sehir", "a"],
      ["mekan-oneri"],
      ["otel-oneri"],
      ["sehir-oneri"],
      ["sohbet-mekan"],
      ["yonetim-mekan"],
      ["yonetim-rehber-mekan"],
      ["yonetim-sehir"],
    ])
      expect(googleSorgusu(k)).toBe(true);
    for (const k of [
      ["mesajlar", "s"],
      ["sohbet-okunmamis", "s"],
      ["icerik", "yerler", "a"],
      ["icerik", "gezi", "slug"],
      ["sihirbaz", "tekrar", "a"],
      ["rota-onbellek", "s"],
      ["profil", "u"],
    ])
      expect(googleSorgusu(k)).toBe(false);
  });
});
