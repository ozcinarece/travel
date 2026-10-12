import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Ikon } from '@/components/ui/Ikon';
import { tasi } from '@/features/yonetim/gezi';
import type { useGeziIslemleri } from '@/features/yonetim/geziSorgulari';
import { ty } from '@/features/yonetim/metin';
import type { Merkez } from '@/features/yerler/api';
import { sureMetni } from '@/lib/kategori';
import { kategoriPini } from '@/lib/pinIkonu';
import type { GeziDuragi, GeziGunu } from '@/lib/tipler';
import { gunRengi, yazi } from '@/theme';

import { Alan, hapStili, MetinKutusu } from '../Form';
import { Hap } from '../Hap';
import { useSuruklenen } from '../surukle';
import { yRenk } from '../tema';
import { MekanArama } from './MekanArama';

type Islemler = ReturnType<typeof useGeziIslemleri>;
type Props = { gunler: GeziGunu[]; merkez: Merkez | undefined; islemler: Islemler; onHata: () => void };

/**
 * KK4 (kanvas "PLAN · 1. GÜN · ODUNPAZARI"): gün seçimi, "+ Gün", durak satırları (tutamaç · gün renginde numara · ad ·
 * kategori ikonu + place_id ✓ · süre hapı · ×), kesikli "Mekan ara" kutusu. Sürükle = sıra (duraklar ve günler).
 * Gün başlığı / gün silme kanvasta yok (tasarım bekliyor): alan kutusu + hap ile.
 */
export function GeziPlanEditoru({ gunler, merkez, islemler, onHata }: Props) {
  const [seciliId, setSeciliId] = useState<string | undefined>(gunler[0]?.id);
  const gun = gunler.find((g) => g.id === seciliId) ?? gunler[0];
  const dene = (is: () => Promise<unknown>) => is().catch(onHata);

  if (!gun) {
    return <Hap baslik={ty('gezi.gunEkle')} onPress={() => dene(() => islemler.gunEkle(gunler))} />;
  }
  const baslikEki = (g: GeziGunu) => (g.baslik ? ` · ${g.baslik}` : '');
  const gunTasi = (kaynak: number, hedef: number) => dene(() => islemler.gunleriSirala(tasi(gunler, kaynak, hedef).map((g) => g.id)));
  const durakTasi = (kaynak: number, hedef: number) => dene(() => islemler.duraklariSirala(gun, tasi(gun.gezi_duraklari, kaynak, hedef).map((d) => d.id)));

  return (
    <View style={s.kap}>
      <View style={s.ust}>
        <Text style={s.etiket}>{ty('gezi.plan', { n: gun.sira, baslik: baslikEki(gun).toLocaleUpperCase('tr-TR') })}</Text>
        <View style={s.gunler}>
          {gunler.map((g, i) =>
            g.id === gun.id ? null : <GunEtiketi key={g.id} gun={g} indeks={i} etiket={ty('gezi.gunEtiket', { n: g.sira, baslik: baslikEki(g) })} onSec={() => setSeciliId(g.id)} onBirak={gunTasi} />,
          )}
          <Hap baslik={ty('gezi.gunEkle')} onPress={() => dene(() => islemler.gunEkle(gunler))} />
        </View>
      </View>
      <View style={s.gunAyar}>
        <Alan etiket={ty('gezi.alan.gunBaslik')}>
          <GunBasligi key={gun.id} gun={gun} onKaydet={(b) => dene(() => islemler.gunBaslik(gun, b))} />
        </Alan>
        {gunler.length > 1 ? (
          <Hap
            baslik={ty('gezi.gunSil')}
            onPress={() =>
              dene(async () => {
                await islemler.gunSil(gun, gunler);
                setSeciliId(undefined);
              })
            }
          />
        ) : null}
      </View>
      {gun.gezi_duraklari.map((d, i) => (
        <DurakSatiri
          key={d.id}
          durak={d}
          indeks={i}
          renk={gunRengi(gun.sira)}
          onBirak={durakTasi}
          onSure={(sure_dk) => dene(() => islemler.durakGuncelle(d, { sure_dk }))}
          onSil={() => dene(() => islemler.durakSil(gun, d))}
        />
      ))}
      <MekanArama merkez={merkez} onSec={(yer) => islemler.durakEkle(gun, yer)} />
    </View>
  );
}

function GunEtiketi({ gun, indeks, etiket, onSec, onBirak }: { gun: GeziGunu; indeks: number; etiket: string; onSec: () => void; onBirak: (k: number, h: number) => void }) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, `gun-${gun.gezi_id}`, indeks, onBirak);
  return (
    <Pressable ref={ref} accessibilityRole="button" onPress={onSec}>
      <Text style={s.etiket}>{etiket}</Text>
    </Pressable>
  );
}

function GunBasligi({ gun, onKaydet }: { gun: GeziGunu; onKaydet: (b: string) => void }) {
  const [deger, setDeger] = useState(gun.baslik ?? '');
  const kaydet = () => deger.trim() !== (gun.baslik ?? '') && onKaydet(deger);
  return <MetinKutusu value={deger} onChangeText={setDeger} onBlur={kaydet} onSubmitEditing={kaydet} maxLength={60} accessibilityLabel={ty('gezi.alan.gunBaslik')} />;
}

const TUTAMAC = 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01';

function DurakSatiri({
  durak,
  indeks,
  renk,
  onBirak,
  onSure,
  onSil,
}: {
  durak: GeziDuragi;
  indeks: number;
  renk: string;
  onBirak: (k: number, h: number) => void;
  onSure: (dk: number) => void;
  onSil: () => void;
}) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, `durak-${durak.gezi_gun_id}`, indeks, onBirak);
  const kategori = kategoriPini(durak.kategori);
  return (
    <View ref={ref} style={s.satir}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#c8c8c4" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d={TUTAMAC} />
      </Svg>
      <View style={[s.numara, { backgroundColor: renk }]}>
        <Text style={s.numaraMetin}>{indeks + 1}</Text>
      </View>
      <View style={s.ad}>
        <Text style={s.adMetin} numberOfLines={1}>
          {durak.ad}
        </Text>
        <Text style={s.alt}> · </Text>
        <Ikon ad={kategori.ikon} boyut={11} renk={kategori.kategoriRenk} kalinlik={2.2} />
        <Text style={s.alt}> {ty(durak.place_id ? 'gezi.placeVar' : 'gezi.placeYok')}</Text>
      </View>
      <SureHapi key={durak.sure_dk} dakika={durak.sure_dk} etiket={ty('gezi.sure', { ad: durak.ad })} onKaydet={onSure} />
      <Pressable accessibilityRole="button" accessibilityLabel={ty('gezi.durakSil', { ad: durak.ad })} onPress={onSil} hitSlop={8}>
        <Text style={s.sil}>×</Text>
      </Pressable>
    </View>
  );
}

/** Kanvas süre hapı; odaklanınca dakika girilir (15–480), çıkınca "1 sa 30 dk" biçimine döner. */
function SureHapi({ dakika, etiket, onKaydet }: { dakika: number; etiket: string; onKaydet: (dk: number) => void }) {
  const [odak, setOdak] = useState(false);
  const [deger, setDeger] = useState(String(dakika));
  const bitir = () => {
    setOdak(false);
    const dk = Math.min(480, Math.max(15, Math.round(Number(deger) || dakika)));
    setDeger(String(dk));
    if (dk !== dakika) onKaydet(dk);
  };
  return (
    <View style={hapStili.kap}>
      <TextInput
        value={odak ? deger : sureMetni(dakika)}
        onFocus={() => setOdak(true)}
        onChangeText={(m) => setDeger(m.replace(/\D/g, ''))}
        onBlur={bitir}
        onSubmitEditing={bitir}
        inputMode="numeric"
        accessibilityLabel={etiket}
        style={[hapStili.metin, s.sureGirdi]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 6 },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  gunler: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  gunAyar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 4 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac },
  numara: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  numaraMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.zemin },
  ad: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  adMetin: { flexShrink: 1, fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  alt: { fontFamily: yazi.yari, fontSize: 11, color: yRenk.ikincil },
  sureGirdi: { width: 72, textAlign: 'center' },
  sil: { fontFamily: yazi.normal, fontSize: 12.5, color: yRenk.ikincil },
});
