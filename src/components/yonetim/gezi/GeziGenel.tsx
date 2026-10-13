import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import {
  durumAlanlari,
  gecerliSlug,
  geziDurumu,
  istanbuldanIso,
  istanbulParcalari,
  slugUret,
  tarihGosterimi,
  type GeziAlanlari,
  type GeziDurumu,
} from '@/features/yonetim/gezi';
import type { YonetimSehri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import { okumaSuresiDk } from '@/lib/markdown';
import { AYLAR_KISA } from '@/lib/takvim';
import { yazi } from '@/theme';

import { Alan, AlanSatiri, DurumRozeti, MetinKutusu, SecimKutusu } from '../Form';
import { yRenk } from '../tema';

type Props = {
  taslak: GeziAlanlari;
  sehirler: YonetimSehri[];
  degistir: (alanlar: Partial<GeziAlanlari> | ((t: GeziAlanlari) => Partial<GeziAlanlari>), hemen?: boolean) => void;
  slugHatasi: boolean;
};

const DURUMLAR: GeziDurumu[] = ['taslak', 'planli', 'yayinda'];
const TURUNCU = yRenk.vurgu;
const KIRMIZI = yRenk.hata;

/**
 * KK2 (kanvas BekleyenTasarim21 ekran 4): BAŞLIK · ŞEHİR (170); DURUM (200, açılır menü: Taslak yalnız sen · Planlı
 * tarihte açılır · Yayında hemen, rozet renkleriyle) + Planlı seçilince turuncu çerçeveli tarih ve saat (İstanbul);
 * SLUG "gezi/" önekli, başlıktan otomatik, elle düzenlenir, çakışma kırmızı satır; ÖZET · YAZAR (110) · OKUMA (130, otomatik).
 */
export function GeziGenel({ taslak, sehirler, degistir, slugHatasi }: Props) {
  const durum = geziDurumu(taslak);
  // Slug elle değiştirilmediyse başlıkla birlikte yenilenir (yeni gezinin geçici slug'ı dahil).
  const slugOtomatik = taslak.slug === slugUret(taslak.baslik) || /^yeni-gezi-[a-z0-9]{4}$/.test(taslak.slug);
  const baslikDegisti = (baslik: string) => degistir(slugOtomatik ? { baslik, slug: slugUret(baslik) } : { baslik });
  const slugGecersiz = !gecerliSlug(taslak.slug);

  return (
    <View style={s.kap}>
      <AlanSatiri>
        <Alan etiket={ty('gezi.alan.baslik')}>
          <MetinKutusu value={taslak.baslik} onChangeText={baslikDegisti} maxLength={120} accessibilityLabel={ty('gezi.alan.baslik')} />
        </Alan>
        <Alan etiket={ty('gezi.alan.sehir')} genislik={170}>
          <SecimKutusu etiket={ty('gezi.alan.sehir')} deger={taslak.sehir_id} onDegis={(sehir_id) => degistir({ sehir_id }, true)} secenekler={sehirler.map((sh) => ({ deger: sh.id, etiket: sh.ad }))} />
        </Alan>
      </AlanSatiri>
      <View style={[s.satir, s.ustte]}>
        <Alan etiket={ty('gezi.alan.durum')} genislik={200}>
          <DurumMenusu durum={durum} onSec={(d) => degistir(durumAlanlari(d, taslak.yayin_at), true)} />
        </Alan>
        {durum === 'planli' && taslak.yayin_at ? <YayinTarihi iso={taslak.yayin_at} onDegis={(yayin_at) => degistir({ yayin_at }, true)} /> : null}
      </View>
      <View style={s.alan}>
        <Text style={s.etiket}>{ty('gezi.alan.slug')}</Text>
        <View style={[s.slugKutu, (slugGecersiz || slugHatasi) && s.slugHatali]}>
          <Text style={s.onek}>{ty('gezi.slugOnek')}</Text>
          <TextInput
            value={taslak.slug}
            onChangeText={(slug) => degistir({ slug: slug.toLowerCase() })}
            autoCapitalize="none"
            maxLength={80}
            accessibilityLabel={ty('gezi.alan.slug')}
            style={s.slugGirdi}
          />
          <Text style={s.slugNot}>{ty(slugOtomatik ? 'gezi.slugOtomatik' : 'gezi.slugElle')}</Text>
        </View>
        {slugGecersiz || slugHatasi ? <Text style={s.hata}>{ty(slugHatasi ? 'gezi.slugHata' : 'gezi.slugGecersiz')}</Text> : null}
      </View>
      <AlanSatiri>
        <Alan etiket={ty('gezi.alan.ozet')}>
          <MetinKutusu value={taslak.ozet ?? ''} onChangeText={(ozet) => degistir({ ozet: ozet || null })} maxLength={140} accessibilityLabel={ty('gezi.alan.ozet')} />
        </Alan>
        <Alan etiket={ty('gezi.alan.yazar')} genislik={110}>
          <MetinKutusu value={taslak.yazar_ad ?? ''} onChangeText={(yazar_ad) => degistir({ yazar_ad: yazar_ad || null })} maxLength={60} accessibilityLabel={ty('gezi.alan.yazar')} />
        </Alan>
        <Alan etiket={ty('gezi.alan.okuma')} genislik={130}>
          <View style={s.saltOkunur}>
            <Text style={s.saltMetin}>{ty('gezi.okumaOtomatik', { n: okumaSuresiDk(taslak.yazi_md) })}</Text>
          </View>
        </Alan>
      </AlanSatiri>
    </View>
  );
}

/** Durum açılır menüsü: 36 px kutu (açıkken siyah çerçeve) + 64 px aşağıda gölgeli liste; dışarı tıklayınca kapanır. */
function DurumMenusu({ durum, onSec }: { durum: GeziDurumu; onSec: (d: GeziDurumu) => void }) {
  const [acik, setAcik] = useState(false);
  return (
    <View style={s.menuKap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ty('gezi.alan.durum')}
        accessibilityState={{ expanded: acik }}
        onPress={() => setAcik((a) => !a)}
        style={StyleSheet.flatten([s.kutu, acik && s.kutuAcik])}>
        <Text style={s.kutuMetin}>{ty(`gezi.durum.${durum}`)}</Text>
        <Text style={s.ok}>▾</Text>
      </Pressable>
      {acik ? (
        <>
          <Pressable accessibilityLabel={ty('gezi.menuKapat')} onPress={() => setAcik(false)} style={s.perde} />
          <View style={s.menu}>
            {DURUMLAR.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: d === durum }}
                onPress={() => {
                  setAcik(false);
                  if (d !== durum) onSec(d);
                }}
                // react-native-web üzerine gelmeyi (hovered) de verir; seçili satır kanvastaki gibi #f6f6f4.
                style={(durumu) => [s.menuSatir, (d === durum || (durumu as { hovered?: boolean }).hovered) && s.menuSatirSecili]}>
                <DurumRozeti durum={d} etiket={ty(`gezi.durum.${d}`)} />
                <Text style={s.menuAciklama}>{ty(`gezi.durumAciklama.${d}`)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Planlı yayın: turuncu çerçeveli tarih ("20 Eki 2026", takvim ikonu) ve saat (80 px); altında "Uygulamada … görünür (İstanbul)". */
function YayinTarihi({ iso, onDegis }: { iso: string; onDegis: (iso: string) => void }) {
  const { tarih, saat } = istanbulParcalari(iso);
  const yaz = (t: string, sa: string) => {
    const yeni = istanbuldanIso(t, sa);
    if (yeni && yeni !== iso) onDegis(yeni);
  };
  const [, ay, gun] = tarih.split('-').map(Number);
  return (
    <View style={[s.alan, s.esnek]}>
      <Text style={[s.etiket, { color: TURUNCU }]}>{ty('gezi.alan.planli')}</Text>
      <View style={s.satir}>
        <View style={[s.turuncuKutu, s.esnek]}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={yRenk.metin} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Rect x="3" y="5" width="18" height="16" rx="2" />
            <Path d="M3 10h18M8 3v4M16 3v4" />
          </Svg>
          <Text style={s.kutuMetin}>{tarihGosterimi(tarih)}</Text>
          <GizliGirdi tur="date" deger={tarih} etiket={ty('gezi.alan.planliTarih')} onDegis={(t) => yaz(t, saat)} />
        </View>
        <View style={[s.turuncuKutu, s.saat]}>
          <Text style={s.kutuMetin}>{saat}</Text>
          <GizliGirdi tur="time" deger={saat} etiket={ty('gezi.alan.planliSaat')} onDegis={(sa) => yaz(tarih, sa)} />
        </View>
      </View>
      <Text style={s.not}>{ty('gezi.planliNot', { gun, ay: AYLAR_KISA[ay - 1], saat })}</Text>
    </View>
  );
}

/** Kutunun üstünde görünmez tarayıcı denetimi: tıklanınca kendi seçicisi açılır, görünen kanvastaki metin. */
function GizliGirdi({ tur, deger, etiket, onDegis }: { tur: 'date' | 'time'; deger: string; etiket: string; onDegis: (d: string) => void }) {
  return (
    <input
      type={tur}
      aria-label={etiket}
      value={deger}
      onChange={(e) => e.target.value && onDegis(e.target.value)}
      onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 0 }}
    />
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  satir: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ustte: { zIndex: 5 },
  alan: { gap: 5 },
  esnek: { flex: 1, minWidth: 0 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  menuKap: { position: 'relative' },
  kutu: { height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: yRenk.cerceve, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kutuAcik: { borderColor: yRenk.metin },
  kutuMetin: { fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin },
  ok: { fontFamily: yazi.kalin, fontSize: 13, color: yRenk.ikincil },
  perde: { position: 'fixed' as 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 4, cursor: 'auto' },
  menu: { position: 'absolute', left: 0, right: 0, top: 42, zIndex: 5, padding: 6, borderRadius: 12, backgroundColor: yRenk.zemin, boxShadow: '0 10px 30px rgba(14,20,48,0.16)', gap: 2 },
  menuSatir: { height: 34, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuSatirSecili: { backgroundColor: yRenk.yuzey },
  menuAciklama: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.ikincil },
  turuncuKutu: { height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: TURUNCU, flexDirection: 'row', alignItems: 'center', gap: 8, position: 'relative' },
  saat: { width: 80, justifyContent: 'center' },
  not: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  slugKutu: { height: 36, borderRadius: 10, borderWidth: 1, borderColor: yRenk.cerceve, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  slugHatali: { borderColor: KIRMIZI },
  onek: { alignSelf: 'stretch', paddingHorizontal: 10, backgroundColor: yRenk.yuzey, borderRightWidth: 1, borderRightColor: yRenk.cerceve, fontFamily: yazi.yari, fontSize: 13, lineHeight: 34, color: yRenk.ikincil },
  slugGirdi: { flex: 1, minWidth: 0, paddingHorizontal: 10, fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin, height: 34 },
  slugNot: { paddingHorizontal: 10, fontFamily: yazi.kalin, fontSize: 11, color: yRenk.ikincil },
  hata: { fontFamily: yazi.kalin, fontSize: 11, color: KIRMIZI },
  saltOkunur: { minHeight: 36, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: yRenk.cerceve, justifyContent: 'center' },
  saltMetin: { fontFamily: yazi.kalin, fontSize: 13, color: yRenk.metin },
});
