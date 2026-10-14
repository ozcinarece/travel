// #98 B → #164 / #165 (kanvas 9 · 9b · 9c): Keşfet öneri çekmecesi — üç hal: küçük (tutamak + tek satır "Bu bölgede önerilen · N"
// + "Listende N") → yarım (aynı başlık + satırlar: foto 52, ad, "Kategori · ★ puan · süre", EkleDugmesi) → tam (durum çubuğunun
// altına kadar; sabit başlık + "N yer" + filtre + hızlı çipler, iki sütun fotoğraflı kart, yüzen "Haritaya dön").
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { SayfaHali } from '@/components/harita/AltSayfa';
import { EkleDugmesi } from '@/components/ui/EkleDugmesi';
import { Ikon } from '@/components/ui/Ikon';
import { SayfaKaydirmasi, useSayfaKaydirma } from '@/components/ui/sayfaCekme';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { bosluk, renk, yazi } from '@/theme';

/** Satır / kart verisi: Google önerisi ya da rehber yeri (foto, öne çıkan ve süre çekmecenin elindeki veriden; ek istek yok). */
export type CekmeceOgesi = {
  place_id: string;
  ad: string;
  primary_type: string | null;
  puan: number | null;
  foto_uri: string | null;
  oneCikan: boolean;
  /** Varsayılan kalış süresi (dk) — listedeyse mekanın kendi süresi (Program'la aynı kaynak). */
  dakika: number;
  /** "+" ile eklenecek hafif veri. */
  yer: HafifYer;
};

type Ortak = {
  havuz: Set<string>;
  mesgulId: string | null;
  onEkle: (y: HafifYer) => void;
  onCikar: (placeId: string) => void;
  onAc: (placeId: string) => void;
  /** #189 KK3: görünür alanda az öneri kaldıysa listenin altındaki (boşsa yerindeki) yönlendirme satırı. */
  azMetni?: string | null;
};

/** #165 KK3/KK7: "Kategori · ★ 4,7 · 1 sa". */
export function ogeMetni(o: Pick<CekmeceOgesi, 'primary_type' | 'puan' | 'dakika'>): string {
  const puan = puanMetni(o.puan);
  return [kategoriEtiketi(o.primary_type), puan ? `★ ${puan}` : null, sureMetni(o.dakika)].filter(Boolean).join(' · ');
}

/**
 * #141 KK7 (kanvas 9): sağda "Listende N" — dokununca harita ve çekmece yalnız listeyi gösterir (öneri pinleri gizlenir); tekrar
 * dokununca önerilere döner. #164 KK4: kısa etiket — başlığa yer kalsın; sığmazsa başlık "…" ile kısalır, düğme küçülmez.
 */
type ListeDugmesi = { sayi: number; yalniz: boolean; onPress: () => void };

function ListeGoster({ sayi, yalniz, onPress }: ListeDugmesi) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: yalniz }} accessibilityHint={yalniz ? undefined : t('kesfet.cekmece.listendeIpucu')} onPress={onPress} style={({ pressed }) => [s.listeDugme, yalniz && s.listeDugmeAcik, pressed && { opacity: 0.85 }]}>
      <View style={s.listeKare} />
      <Text style={s.listeDugmeMetin} numberOfLines={1}>
        {yalniz ? t('kesfet.cekmece.onerilereDon') : t('kesfet.cekmece.listende', { n: sayi })}
      </Text>
    </Pressable>
  );
}

/**
 * Üst şerit (tutamakla birlikte sürüklenir; tam halde kaydırırken üstte sabit kalır). Küçük ve yarım halde tek satır başlık; tam
 * halde Archivo başlık + "N yer" + filtre düğmesi, altında `cipler`.
 */
export function CekmeceSeridi({ hal, sayi, onHal, liste, tam }: { hal: SayfaHali; sayi: number; onHal: (h: SayfaHali) => void; liste?: ListeDugmesi; tam?: { yerSayisi: number; onFiltre: () => void; cipler: ReactNode } }) {
  const listeDugmesi = liste && (liste.sayi > 0 || liste.yalniz) ? <ListeGoster {...liste} /> : null;
  const baslik = liste?.yalniz ? t('kesfet.cekmece.listeBaslik', { n: liste.sayi }) : t('kesfet.cekmece.kucuk', { n: sayi });
  return (
    <View style={s.serit}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(hal === 'katli' ? 'kesfet.cekmece.ac' : 'kesfet.cekmece.kapat')} onPress={() => onHal(hal === 'katli' ? 'yari' : 'katli')} hitSlop={8} style={s.tutamakDokunma}>
        <View style={s.tutamak} />
      </Pressable>
      {hal === 'tam' && tam ? (
        <View style={s.tamUst}>
          <View style={s.seritSatir}>
            <Text accessibilityRole="header" style={s.tamBaslik} numberOfLines={1}>
              {liste?.yalniz ? t('kesfet.cekmece.listeBaslik', { n: liste.sayi }) : t('kesfet.cekmece.baslik')}
            </Text>
            {liste?.yalniz ? (
              listeDugmesi
            ) : (
              <>
                <Text style={s.yerSayisi}>{t('kesfet.cekmece.yerSayisi', { n: tam.yerSayisi })}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('kesfet.filtre.ac')} onPress={tam.onFiltre} hitSlop={2} style={({ pressed }) => [s.filtreDugme, pressed && { opacity: 0.85 }]}>
                  <Ikon ad="filtre" boyut={18} renk={renk.ana} kalinlik={2.4} />
                </Pressable>
              </>
            )}
          </View>
          {liste?.yalniz ? null : tam.cipler}
        </View>
      ) : (
        <View style={s.seritSatir}>
          <Pressable accessibilityRole="button" disabled={hal !== 'katli'} onPress={() => onHal('yari')} style={s.kucukDokun}>
            <Text style={s.kucukMetin} numberOfLines={1} ellipsizeMode="tail">
              {baslik}
            </Text>
          </Pressable>
          {listeDugmesi ?? (hal === 'katli' ? <Ikon ad="yukari" boyut={18} renk={renk.metin} kalinlik={2.2} /> : null)}
        </View>
      )}
    </View>
  );
}

function BosDurum({ azMetni }: { azMetni?: string | null }) {
  return <Text style={s.bos}>{azMetni ?? t('kesfet.cekmece.bos')}</Text>;
}

function AzSatiri({ metin }: { metin?: string | null }) {
  return metin ? <Text style={s.az}>{metin}</Text> : null;
}

/** #165 KK3–4 (kanvas 9b) yarım hal: satır listesi, çekmecenin içinde kayar. */
export function CekmeceSatirlari({ liste, yukseklik, ...o }: Ortak & { liste: CekmeceOgesi[]; yukseklik: number }) {
  // #164 KK7: liste en üstteyken içerikten aşağı çekiş çekmeceyi bir alt hale indirir; değilse önce liste kayar.
  const sayfaKaydirma = useSayfaKaydirma();
  return (
    <SayfaKaydirmasi>
      <FlatList
        data={liste}
        keyExtractor={(y) => y.place_id}
        style={{ height: yukseklik }}
        onScroll={sayfaKaydirma}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={s.satirlar}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<BosDurum azMetni={o.azMetni} />}
        ListFooterComponent={liste.length > 0 ? <AzSatiri metin={o.azMetni} /> : null}
        renderItem={({ item: y }) => {
          const listede = o.havuz.has(y.place_id);
          return (
            <Pressable accessibilityRole="button" onPress={() => o.onAc(y.place_id)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.8 }]}>
              <Foto oge={y} stil={s.satirFoto} />
              <View style={s.satirMetin}>
                <Text style={s.satirAd} numberOfLines={1}>
                  {y.ad}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {ogeMetni(y)}
                </Text>
              </View>
              {/* #136 KK5: tek EkleDugmesi — listedeyse açık yeşil ✓, dokununca çıkar. */}
              <EkleDugmesi listede={listede} mesgul={o.mesgulId === y.place_id} onPress={() => (listede ? o.onCikar(y.place_id) : o.onEkle(y.yer))} />
            </Pressable>
          );
        }}
      />
    </SayfaKaydirmasi>
  );
}

/** #165 KK7 (kanvas 9c) tam hal: iki sütun kart; başlık ve çipler şeritte (üstte sabit). Altta yüzen "Haritaya dön". */
export function CekmeceKartlari({ liste, yukseklik, onHaritayaDon, ...o }: Ortak & { liste: CekmeceOgesi[]; yukseklik: number; onHaritayaDon: () => void }) {
  const sayfaKaydirma = useSayfaKaydirma();
  const ekran = useWindowDimensions();
  const genislik = Math.floor((ekran.width - 2 * bosluk.kenar - KART_ARASI) / 2);
  return (
    <View style={{ height: yukseklik }}>
      <SayfaKaydirmasi>
        <FlatList
          data={liste}
          keyExtractor={(m) => m.place_id}
          numColumns={2}
          onScroll={sayfaKaydirma}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          columnWrapperStyle={s.kartSatiri}
          contentContainerStyle={s.kartlar}
          ListEmptyComponent={<BosDurum azMetni={o.azMetni} />}
          ListFooterComponent={liste.length > 0 ? <AzSatiri metin={o.azMetni} /> : null}
          renderItem={({ item }) => <OneriKarti oge={item} genislik={genislik} {...o} />}
        />
      </SayfaKaydirmasi>
      <HaritayaDon onPress={onHaritayaDon} />
    </View>
  );
}

/** Tam halde yalnız listedekiler (satırlar) gösterilirken de "Haritaya dön" yüzer. */
export function HaritayaDonlu({ yukseklik, onHaritayaDon, children }: { yukseklik: number; onHaritayaDon: () => void; children: ReactNode }) {
  return (
    <View style={{ height: yukseklik }}>
      {children}
      <HaritayaDon onPress={onHaritayaDon} />
    </View>
  );
}

/** #165 KK8: alt menünün üstünde, ortada yüzen Gece hap; dokununca çekmece küçük hale iner. */
function HaritayaDon({ onPress }: { onPress: () => void }) {
  return (
    <View style={s.haritayaDonKap} pointerEvents="box-none">
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.haritayaDon, pressed && { opacity: 0.9 }]}>
        <Ikon ad="harita" boyut={18} renk={renk.zemin} kalinlik={2.3} />
        <Text style={s.haritayaDonMetin}>{t('kesfet.cekmece.haritayaDon')}</Text>
      </Pressable>
    </View>
  );
}

const KART_ARASI = 12;

function OneriKarti({ oge, genislik, ...o }: Ortak & { oge: CekmeceOgesi; genislik: number }) {
  const listede = o.havuz.has(oge.place_id);
  return (
    <Pressable accessibilityRole="button" onPress={() => o.onAc(oge.place_id)} style={({ pressed }) => [s.kart, { width: genislik }, pressed && { opacity: 0.85 }]}>
      <View>
        <Foto oge={oge} stil={s.kartFoto} />
        {oge.oneCikan ? (
          <View style={s.rozet}>
            <Text style={s.rozetMetin}>{t('mekan.panel.oneCikan')}</Text>
          </View>
        ) : null}
        <View style={s.kartEkle}>
          <EkleDugmesi listede={listede} mesgul={o.mesgulId === oge.place_id} onPress={() => (listede ? o.onCikar(oge.place_id) : o.onEkle(oge.yer))} />
        </View>
      </View>
      <Text style={s.kartAd} numberOfLines={2}>
        {oge.ad}
      </Text>
      <Text style={s.meta} numberOfLines={1}>
        {ogeMetni(oge)}
      </Text>
    </Pressable>
  );
}

/** Fotoğraf; yoksa kategori renginde zemin. */
function Foto({ oge, stil }: { oge: CekmeceOgesi; stil: object }) {
  return (
    <View style={[stil, { backgroundColor: kategoriPini(oge.primary_type).kategoriRenk }]}>
      {oge.foto_uri ? <Image source={{ uri: oge.foto_uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  serit: { paddingHorizontal: bosluk.kenar, paddingBottom: 8 },
  tutamakDokunma: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 30 },
  tutamak: { width: 40, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  seritSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  kucukDokun: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  // #164 KK4 (kanvas 9): tek satır, 15 px.
  kucukMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  listeDugme: { flexShrink: 0, height: 34, paddingLeft: 6, paddingRight: 10, borderRadius: 10, backgroundColor: '#fff1e6', flexDirection: 'row', alignItems: 'center', gap: 6 },
  listeDugmeAcik: { backgroundColor: renk.vurgu },
  listeKare: { width: 20, height: 20, borderRadius: 6, backgroundColor: renk.vurgu, borderWidth: 2, borderColor: renk.ana },
  listeDugmeMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  // #165 KK6 (kanvas 9c): tam hal üstü.
  tamUst: { gap: 12, paddingTop: 2 },
  tamBaslik: { flex: 1, minWidth: 0, fontFamily: yazi.baslik, fontSize: 21, letterSpacing: -0.42, color: renk.metin },
  yerSayisi: { flexShrink: 0, fontFamily: yazi.ekstra, fontSize: 13, color: renk.ikincil },
  filtreDugme: { flexShrink: 0, width: 40, height: 40, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  // #165 KK3 (kanvas 9b): satırlar.
  satirlar: { paddingHorizontal: bosluk.kenar, paddingBottom: 16 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: renk.yuzey },
  satirFoto: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
  satirMetin: { flex: 1, minWidth: 0, gap: 2 },
  satirAd: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  meta: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, textAlign: 'center', paddingVertical: 24, paddingHorizontal: bosluk.kenar },
  az: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil, textAlign: 'center', paddingTop: 16, paddingBottom: 8 },
  // #165 KK7 (kanvas 9c): iki sütun kart.
  kartlar: { paddingHorizontal: bosluk.kenar, paddingTop: 4, paddingBottom: 84, gap: 16 },
  kartSatiri: { gap: KART_ARASI },
  kart: { gap: 6 },
  kartFoto: { height: 118, borderRadius: 16, overflow: 'hidden' },
  rozet: { position: 'absolute', left: 8, top: 8, height: 22, paddingHorizontal: 7, borderRadius: 7, backgroundColor: renk.zemin, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.ana },
  kartEkle: { position: 'absolute', right: 8, bottom: 8 },
  kartAd: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 17, color: renk.metin },
  // #165 KK8: yüzen "Haritaya dön".
  haritayaDonKap: { position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center' },
  haritayaDon: { height: 44, paddingLeft: 14, paddingRight: 18, borderRadius: 999, backgroundColor: renk.ana, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: renk.metin, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 8 },
  haritayaDonMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.zemin },
});
