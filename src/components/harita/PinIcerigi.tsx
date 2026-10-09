import { Image, StyleSheet, Text, View, type ImageRequireSource } from 'react-native';

import { Ikon, type IkonAdi } from '@/components/ui/Ikon';
import { yorumKisa } from '@/lib/pinIkonu';
import { puanMetni } from '@/lib/puan';
import { renk, yazi } from '@/theme';

import { etiketYuksekligi, IGNE, kisaAd, KONUM_HALKA, OTEL_KARE, pinCapi } from './geo';
import { PIN_IKONLARI, pinIkonuAnahtari, pinIkonuPng } from './pinIkonlari';
import type { HaritaPini } from './tipler';

/** #59 §A2: daire içi kategori ikonu 14 px; otel karesindeki ev 16 px. */
const IKON_PX = 14;
const EV_PX = 16;

/** Pinin içindeki ikon (ad + renk); yoksa null. PNG anahtarı buradan türer (pinPngAnahtari). */
function pinIkonu(pin: HaritaPini): { ad: IkonAdi; renk: string } | null {
  if (pin.tur === 'otel') return { ad: 'ev', renk: renk.zemin };
  // #65 (docs/05 §4): araba hapındaki glif rota tonunda (pin.renk = çizginin rengi).
  if (pin.tur === 'etiket') return pin.etiketIkon ? { ad: pin.etiketIkon, renk: pin.etiketIkon === 'araba' ? pin.renk : renk.metin } : null;
  if (pin.tur === 'aday' || pin.tur === 'konum' || !pin.tur) return null;
  if (pin.tamam) return { ad: 'tik', renk: renk.zemin };
  // #61 §4: listede = kategori renginde dolu daire + beyaz kategori ikonu (kategori yoksa siyah + ✓).
  if (pin.tur === 'listede') return pin.ikon && pin.kategoriRenk ? { ad: pin.ikon, renk: renk.zemin } : { ad: 'tik', renk: renk.zemin };
  if (pin.tur === 'oneri' || pin.tur === 'bos') return { ad: pin.ikon ?? 'kamera', renk: pin.kategoriRenk ?? renk.metin };
  return null;
}

/**
 * #59 §B: pinin beklediği PNG ikon anahtarı ("kamera-3b6fe0"); ikon yoksa ya da PNG üretilmemişse (SVG'ye düşer) null.
 * Harita.native, bitmap yakalamasını bu PNG'nin yüklenmesine bağlar — imzaya değil (imza değişince PNG yeniden yüklenmez).
 */
export function pinPngAnahtari(pin: HaritaPini): string | null {
  const i = pinIkonu(pin);
  if (!i) return null;
  const anahtar = pinIkonuAnahtari(i.ad, i.renk);
  return pinIkonuPng(i.ad, i.renk) ? anahtar : null;
}

/**
 * #61 §6: pinin TAM görseli (daire + ikon, scripts/pin-ikonlari.mjs) — Harita.native bunu Marker `image` olarak verir;
 * Android görünüm yakalaması yapmaz, ikon ilk kareden yerindedir. Ad etiketi ayrı, yalnız metinli işaretçidir
 * (`yalnizEtiket`). Görseli olmayan türler (numaralı durak, konum, aday, hap) görünüm olarak çizilir.
 */
export function pinGorseli(pin: HaritaPini): ImageRequireSource | undefined {
  if (pin.tur === 'otel') return PIN_IKONLARI['otel-28'];
  if (pin.tur !== 'oneri' && pin.tur !== 'bos' && pin.tur !== 'listede' && !(pin.tur === 'durak' && pin.tamam)) return undefined;
  // #65: seçili = iğne (çapa ucu, IGNE_CAPA); değilse 28 px daire (çapa merkez).
  const on = pin.secili ? 'igne-' : '';
  const son = pin.secili ? '' : '-28';
  if (pin.tamam) return PIN_IKONLARI[`${on}tamam${son}`];
  if (pin.tur === 'listede') return pin.ikon && pin.kategoriRenk ? PIN_IKONLARI[`${on}dolu-${pin.ikon}${son}`] : PIN_IKONLARI[`${on}tik${son}`];
  return PIN_IKONLARI[`${on}daire-${pin.ikon ?? 'kamera'}${son}`];
}

/**
 * Pin içi ikon önceden üretilmiş PNG (assets/pin, scripts/pin-ikonlari.mjs) — Android işaretçi bitmap'ini alırken
 * SVG'nin çizilmesini beklemek gerekmez; `onYuklendi` görüntü yüklenince PNG anahtarıyla çağrılır. PNG yoksa SVG.
 */
function PinIkonu({ ad, renk: r, boyut, kalinlik, onYuklendi }: { ad: IkonAdi; renk: string; boyut: number; kalinlik: number; onYuklendi?: (pngAnahtari: string) => void }) {
  const png = pinIkonuPng(ad, r);
  if (!png) return <Ikon ad={ad} boyut={boyut} renk={r} kalinlik={kalinlik} />;
  return <Image source={png} style={{ width: boyut, height: boyut }} onLoad={() => onYuklendi?.(pinIkonuAnahtari(ad, r))} fadeDuration={0} />;
}

/**
 * Pin görünümleri (#53, 7 Ekim mockup; #59 §A2 ölçüler): 28 px daire (seçili 34) + ALTINDA kısa ad (+ ★ puan · yorum
 * satırı, `detay`). durak = gün renginde daire + sıra numarası · listede = siyah daire + ✓ · oneri / bos = beyaz daire,
 * kategori renginde kenar ve ikon · seçili = siyah halka · otel = siyah kare + ev · aday (3.3) = beyaz hap "★ puan · ad" ·
 * etiket (#33) = küçük beyaz hap (taksi bacağı süresi). `etiketGizli` çakışma kuralıyla gelir (geo.gizliEtiketler).
 * `onYuklendi(pngAnahtari)`: içerikteki PNG ikon yüklendi (Android bitmap yakalaması için, Harita.native).
 */
export function PinIcerigi({
  pin,
  etiketGizli,
  detay = false,
  onYuklendi,
  yalnizEtiket = false,
  durt = false,
}: {
  pin: HaritaPini;
  etiketGizli?: boolean;
  detay?: boolean;
  onYuklendi?: (pngAnahtari: string) => void;
  /** #61 §6: daire ayrı `image` işaretçisinde; burada dairenin yerinde saydam boşluk + altında ad. */
  yalnizEtiket?: boolean;
  /**
   * #61 §6: PNG yüklendikten sonra görünümün boyutunu 1 px değiştirir — react-native-maps Android yalnız boyut değişince
   * (update → updated++) bitmap'i yeniden alır; görüntü yüklenmesi boyut değiştirmediği için eski (boş) bitmap kalıyordu.
   */
  durt?: boolean;
}) {
  if (pin.tur === 'aday') {
    const puan = puanMetni(pin.puan);
    return (
      <View style={[s.hap, pin.secili && s.hapSecili]} collapsable={false}>
        {puan ? <Text style={[s.yildiz, pin.secili && { color: renk.zemin }]}>★ {puan} ·</Text> : null}
        <Text style={[s.hapMetin, pin.secili && { color: renk.zemin }]} numberOfLines={1}>
          {pin.etiket}
        </Text>
      </View>
    );
  }
  if (pin.tur === 'etiket') {
    // #65 (docs/05 §4): araba süre hapı — beyaz zemin, pin gölgesi, 10,5 px / 800 metin, solda rota tonunda araba glifi.
    const araba = pin.etiketIkon === 'araba';
    return (
      <View style={[s.bacakHap, s.golge, etiketGizli && s.gorunmez, durt && s.durtme]} collapsable={false}>
        {pin.etiketIkon ? <PinIkonu ad={pin.etiketIkon} boyut={12} renk={araba ? pin.renk : renk.metin} kalinlik={2.2} onYuklendi={onYuklendi} /> : null}
        <Text style={s.bacakMetin} numberOfLines={1}>
          {pin.etiket}
        </Text>
      </View>
    );
  }
  if (pin.tur === 'konum') {
    return (
      <View style={s.konumHalka} collapsable={false}>
        <View style={s.konumNokta} />
      </View>
    );
  }
  if (pin.tur === 'otel') {
    return (
      <View style={[s.otel, { backgroundColor: pin.renk }]} collapsable={false}>
        <PinIkonu ad="ev" boyut={EV_PX} renk={renk.zemin} kalinlik={2.2} onYuklendi={onYuklendi} />
      </View>
    );
  }
  const cap = pin.secili ? 28 : pinCapi(pin);
  const daire = { width: cap, height: cap, borderRadius: cap / 2 };
  const puan = puanMetni(pin.puan);
  const yorum = yorumKisa(pin.yorumSayisi);
  const kRenk = pin.kategoriRenk ?? renk.metin;
  return (
    <View style={[s.sutun, durt && s.durtme]} collapsable={false}>
      {yalnizEtiket ? (
        // Daire ayrı image işaretçisinde: dairenin yerinde boşluk; seçili iğnede etiket doğrudan ucun altında (çapa uç).
        pin.secili ? null : <View style={{ width: cap, height: cap }} />
      ) : pin.secili ? (
        // #65: seçili numaralı durak iğne biçimi (görünüm): 38 px baş + uç; gövde ucun üstünde, çapa uç (pinCapasi).
        <View style={s.igne} collapsable={false}>
          <View style={[s.igneBas, { backgroundColor: pin.tamam ? renk.basari : pin.renk }]}>
            {pin.tamam ? <PinIkonu ad="tik" boyut={17} renk={renk.zemin} kalinlik={2.4} onYuklendi={onYuklendi} /> : <Text style={s.igneMetin}>{pin.etiket ?? ''}</Text>}
          </View>
          <View style={[s.igneUc, { backgroundColor: pin.tamam ? renk.basari : pin.renk }]} />
        </View>
      ) : pin.tamam ? (
        // #42 KK7: tamamlanan durak yeşil + tik.
        <View style={[s.daire, daire, { backgroundColor: renk.basari }]} collapsable={false}>
          <PinIkonu ad="tik" boyut={IKON_PX} renk={renk.zemin} kalinlik={2.4} onYuklendi={onYuklendi} />
        </View>
      ) : pin.tur === 'oneri' || pin.tur === 'bos' ? (
        // #53: beyaz daire, kategori renginde 2 px kenar, kategori ikonu.
        <View style={[s.daire, daire, s.beyaz, { borderColor: kRenk }]} collapsable={false}>
          <PinIkonu ad={pin.ikon ?? 'kamera'} boyut={IKON_PX} renk={kRenk} kalinlik={2.1} onYuklendi={onYuklendi} />
        </View>
      ) : pin.tur === 'listede' ? (
        // #61 §4: listede = kategori renginde dolu daire + beyaz kategori ikonu (kategori yoksa #53: siyah + ✓).
        <View style={[s.daire, daire, { backgroundColor: pin.ikon && pin.kategoriRenk ? pin.kategoriRenk : renk.metin }]} collapsable={false}>
          <PinIkonu ad={pin.ikon && pin.kategoriRenk ? pin.ikon : 'tik'} boyut={IKON_PX} renk={renk.zemin} kalinlik={pin.ikon && pin.kategoriRenk ? 2.1 : 2.4} onYuklendi={onYuklendi} />
        </View>
      ) : (
        // #55 §D11: güne atanmış = gün renginde daire + sıra numarası; #61 §5: diğer günler numarasız küçük nokta (%40).
        <View style={[s.daire, daire, { backgroundColor: pin.renk }]} collapsable={false}>
          {pin.etiket ? <Text style={s.daireMetin}>{pin.etiket}</Text> : null}
        </View>
      )}
      <View style={[s.etiketKutu, { height: etiketYuksekligi(detay) }, pin.secili && { marginTop: IGNE.etiketPayi }]}>
        {pin.ad && !etiketGizli ? (
          <View style={s.etiketZemin}>
            {/* #47 D14: tamamlanan pin de adını gösterir (gri). */}
            <Text style={[s.etiket, pin.tamam && { color: renk.ikincil }]} numberOfLines={1}>
              {kisaAd(pin.ad)}
            </Text>
            {detay && puan ? (
              <Text style={s.detay} numberOfLines={1}>
                <Text style={{ color: renk.vurgu }}>★</Text> {puan}
                {yorum ? ` · ${yorum}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sutun: { alignItems: 'center', width: 140 },
  daire: { borderWidth: 2, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  beyaz: { backgroundColor: renk.zemin, borderWidth: 2 },
  // #65: seçili iğne (görünüm): baş 38 (2,5 kenar + 2 siyah halka ≈ kenar 4,5 karma), uç 45° döndürülmüş kare.
  igne: { width: IGNE.en, height: IGNE.boy, alignItems: 'center' },
  igneBas: { width: IGNE.en, height: IGNE.en, borderRadius: IGNE.en / 2, borderWidth: 2.5, borderColor: renk.zemin, alignItems: 'center', justifyContent: 'center', zIndex: 1, shadowColor: renk.metin, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  igneUc: { width: 16, height: 16, marginTop: -11, transform: [{ rotate: '45deg' }], borderBottomRightRadius: 3 },
  igneMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.zemin },
  golge: { shadowColor: renk.metin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 3 },
  daireMetin: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.zemin },
  // Etiket yüksekliği sabit (16 / detaylı 30) ki çapa hesabı (geo.pinCapasi) gizli/görünür fark etmesin.
  etiketKutu: { marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  // #53: ad 11 px, beyaz hale (kutu yok).
  etiketZemin: { paddingHorizontal: 4, alignItems: 'center' },
  etiket: { fontFamily: yazi.kalin, fontSize: 11, lineHeight: 14, color: renk.metin, textShadowColor: '#ffffff', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  detay: { fontFamily: yazi.yari, fontSize: 10, lineHeight: 13, color: renk.ikincil, textShadowColor: '#ffffff', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  hap: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 8, paddingRight: 10, borderRadius: 999, backgroundColor: renk.zemin, maxWidth: 200 },
  hapSecili: { backgroundColor: renk.metin },
  hapMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  yildiz: { fontFamily: yazi.kalin, fontSize: 11, color: renk.vurgu },
  otel: { width: OTEL_KARE, height: OTEL_KARE, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  bacakHap: { flexDirection: 'row', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: renk.zemin, alignItems: 'center', justifyContent: 'center' },
  bacakMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, lineHeight: 14, color: renk.metin },
  gorunmez: { opacity: 0 },
  durtme: { paddingBottom: 1 },
  konumHalka: { width: KONUM_HALKA, height: KONUM_HALKA, borderRadius: KONUM_HALKA / 2, backgroundColor: 'rgba(66,133,244,0.25)', alignItems: 'center', justifyContent: 'center' },
  konumNokta: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#4285f4', borderWidth: 2.5, borderColor: renk.zemin },
});
