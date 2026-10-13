import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Ikon } from '@/components/ui/Ikon';
import { ty } from '@/features/yonetim/metin';
import { hafifYerler, linkCoz, linkGibiMi, useOneriler, yeniOturumJetonu, type HafifYer, type Merkez } from '@/features/yerler/api';
import { kategoriEtiketi } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { yazi } from '@/theme';

import { yRenk } from '../tema';

type Satir = { anahtar: string; ad: string; tip: string | undefined; alt: string; al: () => Promise<HafifYer | undefined> };

/**
 * KK4 (kanvas BekleyenTasarim21 ekran 5): 38 px arama kutusu (odakta 1,5 px siyah); yazınca açılır liste — 34 px kategori
 * karesi, ad 12,5 px 800, kategori ikonu + "kategori · adres", seçili satır #f6f6f4 ve "↵ Ekle"; ↑↓ seç, ↵ ekle, Esc kapat;
 * Google Maps linki yapıştırınca tek sonuç (resolve-link). Arama places-autocomplete (şehre yanlı, 300 ms, ≥ 2 harf),
 * seçimde places-light (oturumu kapatır). Karede fotoğraf yerine kategori rengi (foto ayrı Google isteği olurdu).
 */
export function MekanArama({ merkez, onSec, etiket = ty('gezi.mekanAra') }: { merkez: Merkez | undefined; onSec: (yer: HafifYer) => Promise<void> | void; etiket?: string }) {
  const [girdi, setGirdi] = useState('');
  const [oturum, setOturum] = useState(yeniOturumJetonu);
  const [odak, setOdak] = useState(false);
  const [secili, setSecili] = useState(0);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState(false);
  const link = linkGibiMi(girdi);
  const oneriler = useOneriler('yonetim-mekan', girdi, oturum, undefined, merkez, !link);
  const cozum = useQuery({
    queryKey: ['yonetim-link', girdi.trim()],
    enabled: link,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => (await linkCoz(girdi.trim(), merkez)).yer ?? null,
  });

  const satirlar: Satir[] = link
    ? cozum.data
      ? [{ anahtar: cozum.data.place_id, ad: cozum.data.ad, tip: cozum.data.primary_type ?? undefined, alt: '', al: async () => cozum.data ?? undefined }]
      : []
    : (oneriler.data ?? []).map((o) => ({
        anahtar: o.place_id,
        ad: o.ana,
        tip: o.tipler[0],
        alt: o.ikincil,
        al: async () => (await hafifYerler([o.place_id], { oturum }))[0],
      }));
  const acik = odak && girdi.trim().length >= 2;
  const indeks = Math.min(secili, Math.max(0, satirlar.length - 1));

  const ekle = async (satir: Satir | undefined) => {
    if (!satir) return;
    setHata(false);
    setMesgul(true);
    try {
      const yer = await satir.al();
      if (!yer) throw new Error('bos');
      await onSec(yer);
      setGirdi('');
      setSecili(0);
      setOturum(yeniOturumJetonu());
    } catch {
      setHata(true);
    } finally {
      setMesgul(false);
    }
  };
  const tus = (anahtar: string) => {
    if (anahtar === 'ArrowDown') setSecili((i) => Math.min(i + 1, satirlar.length - 1));
    else if (anahtar === 'ArrowUp') setSecili((i) => Math.max(i - 1, 0));
    else if (anahtar === 'Enter') void ekle(satirlar[indeks]);
    else if (anahtar === 'Escape') setOdak(false);
  };

  return (
    <View style={[s.kap, acik && s.ustte]}>
      <View style={[s.kutu, odak && s.kutuOdak]}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={odak ? yRenk.metin : yRenk.ikincil} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Circle cx="11" cy="11" r="6.5" />
          <Path d="M20 20l-4.2-4.2" />
        </Svg>
        <TextInput
          value={girdi}
          onChangeText={(m) => {
            setGirdi(m);
            setSecili(0);
            setHata(false);
            setOdak(true);
          }}
          onFocus={() => setOdak(true)}
          // Satıra tıklama bulanıklaşmadan önce işlensin.
          onBlur={() => setTimeout(() => setOdak(false), 150)}
          onKeyPress={(e) => {
            const k = e.nativeEvent.key;
            if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === 'Escape') {
              (e as unknown as { preventDefault?: () => void }).preventDefault?.();
              tus(k);
            }
          }}
          placeholder={etiket}
          placeholderTextColor={yRenk.ikincil}
          accessibilityLabel={etiket}
          style={s.girdi}
        />
        {mesgul || oneriler.isFetching || cozum.isFetching ? <ActivityIndicator size="small" color={yRenk.ikincil} /> : null}
      </View>
      {hata ? <Text style={s.hata}>{ty('gezi.araHata')}</Text> : null}
      {acik && satirlar.length ? (
        <View style={s.liste} accessibilityRole="menu">
          {satirlar.map((r, i) => {
            const kat = kategoriPini(r.tip);
            return (
              <Pressable
                key={r.anahtar}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: i === indeks }}
                disabled={mesgul}
                onPress={() => void ekle(r)}
                onHoverIn={() => setSecili(i)}
                style={StyleSheet.flatten([s.satir, i === indeks && s.satirSecili])}>
                <View style={[s.kare, { backgroundColor: kat.kategoriRenk }]} />
                <View style={s.metinler}>
                  <Text style={s.ad} numberOfLines={1}>
                    {r.ad}
                  </Text>
                  <View style={s.altSatir}>
                    <Ikon ad={kat.ikon} boyut={10} renk={kat.kategoriRenk} kalinlik={2.2} />
                    <Text style={s.alt} numberOfLines={1}>
                      {[kategoriEtiketi(r.tip), r.alt].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
                {i === indeks ? <Text style={s.ekle}>{ty('gezi.aramaEkle')}</Text> : null}
              </Pressable>
            );
          })}
          <Text style={s.ipucu}>{ty('gezi.aramaIpucu')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { position: 'relative', gap: 6 },
  ustte: { zIndex: 10 },
  kutu: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: yRenk.cerceve },
  kutuOdak: { borderColor: yRenk.metin },
  // Odak kutunun siyah çerçevesiyle gösterilir; tarayıcının kendi çerçevesi çizilmez.
  girdi: { flex: 1, minWidth: 0, fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin, outlineWidth: 0 },
  hata: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.hata },
  liste: { position: 'absolute', left: 0, right: 0, top: 44, zIndex: 10, padding: 6, borderRadius: 12, backgroundColor: yRenk.zemin, boxShadow: '0 10px 30px rgba(14,20,48,0.16)', gap: 2 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  satirSecili: { backgroundColor: yRenk.yuzey },
  kare: { width: 34, height: 34, borderRadius: 8 },
  metinler: { flex: 1, minWidth: 0 },
  ad: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
  altSatir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  alt: { flexShrink: 1, fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  ekle: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.metin },
  ipucu: { paddingTop: 6, paddingHorizontal: 10, paddingBottom: 2, fontFamily: yazi.yari, fontSize: 10.5, color: yRenk.ikincil },
});
