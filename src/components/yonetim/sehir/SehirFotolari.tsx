import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { FotoKaynagi, IcerikFotosu } from '@/features/yonetim/fotolar';
import { ty } from '@/features/yonetim/metin';
import { dosyaAdi, fotoBilgisi, fotoRolu, type FotoRolu, type SehirAlanlari } from '@/features/yonetim/sehir';
import { icerikFotoUrl } from '@/lib/markdown';
import { AYLAR_KISA } from '@/lib/takvim';
import { yazi } from '@/theme';

import { Hap } from '../Hap';
import { dosyaSec, useBirakmaHedefi, useDosyaBirakma, useSuruklenen } from '../surukle';
import { yRenk } from '../tema';
import { GorselYaDaGradyan } from './Gradyan';

type Props = {
  sehirId: string;
  slug: string;
  taslak: SehirAlanlari;
  fotolar: IcerikFotosu[];
  onYukle: (dosyalar: File[]) => Promise<void>;
  onRol: (yol: string, rol: FotoRolu | null) => void;
  onAltMetin: (yol: string, alt: string) => void;
  onKaynak: (yol: string, kaynak: FotoKaynagi) => void;
  onSil: (yol: string) => void;
};

const YUKLE = 'M12 16V4M6 10l6-6 6 6M4 20h16';
const ARTI = 'M12 5v14M5 12h14';
const KAYNAKLAR: FotoKaynagi[] = ['kendi', 'telifsiz', 'izinli'];

/**
 * KK1 Fotoğraflar (kanvas Sehir19): üstte iki rol kartı (Karo kapağı · kare 64 px; Geniş kapak · 3:2 110 × 64), kesikli
 * yükleme şeridi (sürükle ya da seç), galeri (150 × 112 karolar; rol rozeti, "Rol ▾", seçili 2,5 px siyah çerçeve, ad ·
 * ölçü), seçili foto satırı (ad, bilgi, ALT METİN, KAYNAK, Kırp, Sil), not. Rol, fotoyu üstteki role bırakınca da atanır.
 */
export function SehirFotolari({ sehirId, slug, taslak, fotolar, onYukle, onRol, onAltMetin, onKaynak, onSil }: Props) {
  const [seciliYol, setSeciliYol] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const yukleAlani = useRef<View>(null);
  const yukle = async (dosyalar: File[]) => {
    if (!dosyalar.length) return;
    setMesgul(true);
    try {
      await onYukle(dosyalar);
    } finally {
      setMesgul(false);
    }
  };
  useDosyaBirakma(yukleAlani, yukle);
  const secili = fotolar.find((f) => f.yol === seciliYol) ?? fotolar.find((f) => fotoRolu(f.yol, taslak) === 'karo') ?? fotolar[0];
  const rolFotosu = (rol: FotoRolu) => fotolar.find((f) => fotoRolu(f.yol, taslak) === rol);

  return (
    <View style={s.kap}>
      <View style={s.roller}>
        {(['karo', 'genis'] as const).map((rol, i) => (
          <RolKarti key={rol} rol={rol} sehirId={sehirId} foto={rolFotosu(rol)} url={rol === 'karo' ? taslak.kapak_url : taslak.genis_kapak_url} onBirak={(k) => onRol(fotolar[k].yol, rol)} indeks={i} />
        ))}
      </View>
      <Pressable ref={yukleAlani} accessibilityRole="button" accessibilityLabel={ty('sehir.foto.yukle')} onPress={() => dosyaSec(true, yukle)} style={s.yukle}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={yRenk.ikincil} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Path d={YUKLE} />
        </Svg>
        <Text style={s.yukleMetin}>
          {mesgul ? ty('sehir.foto.yukleniyor') : ty('sehir.foto.kural')}
          <Text style={s.kod}>{` icerik/sehirler/${slug}/`}</Text>
        </Text>
      </Pressable>
      <View style={s.galeri}>
        {fotolar.map((f, i) => (
          <GaleriKaro key={f.yol} foto={f} indeks={i} rol={fotoRolu(f.yol, taslak)} secili={secili?.yol === f.yol} onSec={() => setSeciliYol(f.yol)} onRol={(r) => onRol(f.yol, r)} />
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel={ty('sehir.foto.ekle')} onPress={() => dosyaSec(true, yukle)} style={s.ekle}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={yRenk.ikincil} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d={ARTI} />
          </Svg>
          <Text style={s.ekleMetin}>{ty('sehir.foto.ekle')}</Text>
        </Pressable>
      </View>
      {secili ? <SeciliFoto key={secili.yol} foto={secili} onAltMetin={(a) => onAltMetin(secili.yol, a)} onKaynak={(k) => onKaynak(secili.yol, k)} onSil={() => onSil(secili.yol)} /> : null}
      <Text style={s.not}>{ty('sehir.foto.not')}</Text>
    </View>
  );
}

/** Galeri karosu üstteki rol kartına bırakılınca o role atanır (aynı sürükleme grubu, yalnız bırakma). */
function RolKarti({ rol, sehirId, foto, url, onBirak, indeks }: { rol: FotoRolu; sehirId: string; foto: IcerikFotosu | undefined; url: string | null; onBirak: (kaynak: number) => void; indeks: number }) {
  const ref = useRef<View>(null);
  useBirakmaHedefi(ref, 'sehir-foto', indeks, (kaynak) => onBirak(kaynak));
  return (
    <View ref={ref} style={s.rolKarti}>
      <GorselYaDaGradyan uri={url} anahtar={`${sehirId}${rol}`} style={rol === 'karo' ? s.rolKare : s.rolGenis} />
      <View style={s.rolMetin}>
        <Text style={s.rolEtiket}>{ty(`sehir.foto.rolBaslik.${rol}`)}</Text>
        <Text style={s.rolAd} numberOfLines={1}>
          {foto ? dosyaAdi(foto.yol) : ty('sehir.foto.rolBos')}
        </Text>
        <Text style={s.rolAlt}>{ty(`sehir.foto.rolYeri.${rol}`)}</Text>
      </View>
    </View>
  );
}

function GaleriKaro({ foto, indeks, rol, secili, onSec, onRol }: { foto: IcerikFotosu; indeks: number; rol: FotoRolu | null; secili: boolean; onSec: () => void; onRol: (r: FotoRolu | null) => void }) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, 'sehir-foto', indeks, () => {});
  return (
    <View style={s.karo}>
      <Pressable ref={ref} accessibilityRole="button" accessibilityState={{ selected: secili }} accessibilityLabel={dosyaAdi(foto.yol)} onPress={onSec} style={StyleSheet.flatten([s.karoCerceve, secili && s.karoSecili])}>
        <View style={s.karoGorsel}>
          <Image source={{ uri: icerikFotoUrl(foto.yol) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={foto.altyazi ?? undefined} />
          {rol ? (
            <View style={s.rozet}>
              <Text style={s.rozetMetin}>{ty(`sehir.foto.rol.${rol}`)}</Text>
            </View>
          ) : null}
          <View style={s.rolSec}>
            <Text style={s.rolSecMetin}>{ty('sehir.foto.rolSec')}</Text>
            <select
              aria-label={ty('sehir.foto.rolSecEtiket', { ad: dosyaAdi(foto.yol) })}
              value={rol ?? ''}
              onChange={(e) => onRol((e.target.value || null) as FotoRolu | null)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 0 }}>
              <option value="">{ty('sehir.foto.rolYok')}</option>
              <option value="karo">{ty('sehir.foto.rol.karo')}</option>
              <option value="genis">{ty('sehir.foto.rol.genis')}</option>
            </select>
          </View>
        </View>
      </Pressable>
      <View style={s.karoAlt}>
        <Text style={s.karoAd} numberOfLines={1}>
          {dosyaAdi(foto.yol)}
        </Text>
        {foto.genislik && foto.yukseklik ? <Text style={s.karoOlcu}>{`${foto.genislik}×${foto.yukseklik}`}</Text> : null}
      </View>
    </View>
  );
}

function SeciliFoto({ foto, onAltMetin, onKaynak, onSil }: { foto: IcerikFotosu; onAltMetin: (a: string) => void; onKaynak: (k: FotoKaynagi) => void; onSil: () => void }) {
  const [alt, setAlt] = useState(foto.altyazi ?? '');
  const [silOnay, setSilOnay] = useState(false);
  return (
    <View style={s.secili}>
      <Text style={s.seciliAd}>{dosyaAdi(foto.yol)}</Text>
      <Text style={s.seciliBilgi}>{fotoBilgisi(foto, AYLAR_KISA)}</Text>
      <View style={s.seciliAlan}>
        <Text style={s.seciliEtiket}>{ty('sehir.foto.altMetin')}</Text>
        <input
          aria-label={ty('sehir.foto.altMetin')}
          value={alt}
          maxLength={200}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => alt.trim() !== (foto.altyazi ?? '') && onAltMetin(alt)}
          placeholder={ty('sehir.foto.altZorunlu')}
          style={{ height: 30, padding: '0 10px', borderRadius: 8, background: yRenk.zemin, border: `1px solid ${alt.trim() ? yRenk.cerceve : yRenk.hata}`, fontFamily: yazi.yari, fontSize: 12, minWidth: 200, boxSizing: 'border-box', color: yRenk.metin }}
        />
      </View>
      <Text style={s.seciliEtiket}>{ty('sehir.foto.kaynak')}</Text>
      <select
        aria-label={ty('sehir.foto.kaynak')}
        value={foto.kaynak ?? ''}
        onChange={(e) => e.target.value && onKaynak(e.target.value as FotoKaynagi)}
        style={{ height: 30, padding: '0 10px', borderRadius: 8, background: yRenk.zemin, border: `1px solid ${yRenk.cerceve}`, fontFamily: yazi.yari, fontSize: 12, color: yRenk.metin }}>
        <option value="">{ty('sehir.foto.kaynakSec')}</option>
        {KAYNAKLAR.map((k) => (
          <option key={k} value={k}>
            {ty(`sehir.foto.kaynaklar.${k}`)}
          </option>
        ))}
      </select>
      {/* Kırpma ekranı kanvasta yok (tasarım bekliyor). */}
      <View style={s.pasif}>
        <Hap kucuk baslik={ty('sehir.foto.kirp')} onPress={() => {}} />
      </View>
      <Hap kucuk baslik={ty(silOnay ? 'sehir.foto.silOnay' : 'sehir.foto.sil')} onPress={() => (silOnay ? onSil() : setSilOnay(true))} />
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 14 },
  roller: { flexDirection: 'row', gap: 12 },
  rolKarti: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: yRenk.ayrac },
  rolKare: { width: 64, height: 64, borderRadius: 10 },
  rolGenis: { width: 110, height: 64, borderRadius: 10 },
  rolMetin: { flex: 1, minWidth: 0, gap: 2 },
  rolEtiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  rolAd: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  rolAlt: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  yukle: { height: 64, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: yRenk.cerceve, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  yukleMetin: { fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.ikincil },
  kod: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 },
  galeri: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  karo: { width: 150, gap: 6 },
  karoCerceve: { borderRadius: 12 },
  karoSecili: { outlineWidth: 2.5, outlineStyle: 'solid', outlineColor: yRenk.metin, outlineOffset: 2 },
  karoGorsel: { width: 150, height: 112, borderRadius: 12, overflow: 'hidden', backgroundColor: yRenk.yuzey },
  rozet: { position: 'absolute', left: 10, top: 10, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: yRenk.metin, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, color: yRenk.zemin },
  rolSec: { position: 'absolute', right: 8, top: 8, height: 26, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center' },
  rolSecMetin: { fontFamily: yazi.ekstra, fontSize: 10.5, color: yRenk.metin },
  karoAlt: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  karoAd: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 11, color: yRenk.metin },
  karoOlcu: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  ekle: { width: 150, height: 112, borderRadius: 12, backgroundColor: yRenk.yuzey, alignItems: 'center', justifyContent: 'center', gap: 6 },
  ekleMetin: { fontFamily: yazi.kalin, fontSize: 12, color: yRenk.ikincil },
  secili: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: yRenk.yuzey },
  seciliAd: { fontFamily: yazi.ekstra, fontSize: 12, color: yRenk.metin },
  seciliBilgi: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
  seciliAlan: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  seciliEtiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  pasif: { opacity: 0.5, pointerEvents: 'none' },
  not: { fontFamily: yazi.yari, fontSize: 11.5, lineHeight: 16.7, color: yRenk.ikincil },
});
