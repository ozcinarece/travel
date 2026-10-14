// #183 KK1–KK3 (kanvas 25): Harcamalar sekmesi — üstte "‹ {seyahat}" + yüzler; Gece özet kartı (toplam, kişi başı, senin
// durumun + kime ne; Bakiyeler · Özet); filtre (Tümü · Benim · Kategori); günlere göre gruplu liste (gün toplamı sağda);
// sağ altta "+ Harcama". Satıra dokununca aynı form açılır (ekleyen ya da sahip düzenler). Hepsi bizim veritabanımız.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrupPenceresi } from '@/components/davet/GrupPenceresi';
import { HarcamaFormu } from '@/components/harcama/HarcamaFormu';
import { HarcamaSatiri } from '@/components/harcama/HarcamaSatiri';
import { HatirlatmaSatiri } from '@/components/harcama/HatirlatmaSatiri';
import { OzetPenceresi } from '@/components/harcama/OzetPenceresi';
import { GeriHapi } from '@/components/harita/HaritaEkrani';
import { SeyahatYukleme } from '@/components/seyahatler/SeyahatYukleme';
import { Avatar } from '@/components/ui/Avatar';
import { Cip } from '@/components/ui/Cip';
import { Ikon } from '@/components/ui/Ikon';
import { SegmentSecici } from '@/components/ui/SegmentSecici';
import { yonelmeEki } from '@/features/davet/katilim';
import { geziyeGit } from '@/features/gezi/gezinti';
import { gunGruplari, harcamaOzeti, hatirlatmaVakti, KATEGORILER, paraMetni, sayiBicimi, yaklasikPara, type Harcama, type HarcamaKategorisi, type Odesme } from '@/features/harcama/hesap';
import { kisiler as kisiKaynagi } from '@/features/harcama/metin';
import { useHarcamalar, useIbanlar, useOdesmeler } from '@/features/harcama/sorgular';
import { useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { useSimdi } from '@/features/program/useProgram';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import { GUNLER, haftaGunu, parcala } from '@/lib/takvim';
import type { Mekan, Seyahat, Uye } from '@/lib/tipler';
import { yerelTarih } from '@/lib/zaman';
import { renk, yazi } from '@/theme';

const BEYAZ_14 = 'rgba(255,255,255,0.14)';
const ACIK_YESIL = '#7ee2b3';
const ACIK_KIRMIZI = '#ffa59b';

export default function HarcamaSekmesi() {
  const id = useSeyahatId();
  const seyahat = useSeyahat(id);
  const uyeler = useUyeler(id);
  const harcamalar = useHarcamalar(id);
  const odesmeler = useOdesmeler(id);
  const mekanlar = useMekanlar(id);
  if (!id || !seyahat.data || !uyeler.data || !harcamalar.data || !odesmeler.data) {
    return <SeyahatYukleme sorgular={[seyahat, uyeler, harcamalar, odesmeler]} kimlikYok={!id} />;
  }
  return <Harcamalar seyahat={seyahat.data} uyeler={uyeler.data} harcamalar={harcamalar.data} odesmeler={odesmeler.data} mekanlar={mekanlar.data ?? []} />;
}

type Filtre = 'tumu' | 'benim' | 'kategori';

function Harcamalar({ seyahat, uyeler, harcamalar, odesmeler, mekanlar }: { seyahat: Seyahat; uyeler: Uye[]; harcamalar: Harcama[]; odesmeler: Odesme[]; mekanlar: Mekan[] }) {
  const { session } = useOturum();
  const benId = session?.user.id ?? null;
  const kenar = useSafeAreaInsets();
  const an = useSimdi(true);
  const k = useMemo(() => kisiKaynagi(uyeler), [uyeler]);
  const gununTarihi = useMemo(() => (iso: string) => yerelTarih(new Date(iso), seyahat.tz), [seyahat.tz]);
  const ozet = useMemo(() => harcamaOzeti({ harcamalar, odesmeler, benId, bugun: yerelTarih(an, seyahat.tz), gununTarihi }), [harcamalar, odesmeler, benId, an, seyahat.tz, gununTarihi]);
  const ibanlar = useIbanlar(ozet.benimNet < 0 ? ozet.karsilar.map((x) => x.id) : []);

  const [filtre, setFiltre] = useState<Filtre>('tumu');
  const [kategori, setKategori] = useState<HarcamaKategorisi | null>(null);
  const [form, setForm] = useState<{ harcama: Harcama | null } | null>(null);
  const [ozetAcik, setOzetAcik] = useState(false);
  const [grupAcik, setGrupAcik] = useState(false);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const bildir = (m: string) => {
    setBildirim(m);
    setTimeout(() => setBildirim(null), 2500);
  };

  const benim = harcamalar.filter((h) => h.odeyen_id === benId);
  const kategoriSayilari = KATEGORILER.map((kat) => ({ kat, n: harcamalar.filter((h) => h.kategori === kat).length })).filter((x) => x.n > 0);
  const seciliKategori = kategori ?? kategoriSayilari[0]?.kat ?? null;
  const gorunen = filtre === 'benim' ? benim : filtre === 'kategori' ? harcamalar.filter((h) => h.kategori === seciliKategori) : harcamalar;
  const gruplar = gunGruplari(gorunen, gununTarihi);
  const bakiyeler = () => router.push({ pathname: '/seyahat/[id]/bakiyeler', params: { id: seyahat.id } });

  const kisiSayisi = Math.max(1, uyeler.length);
  const durumAlt =
    ozet.karsilar.length === 0
      ? harcamalar.length > 0
        ? t('harcama.odesmissin')
        : ''
      : ozet.benimNet > 0
        ? ozet.karsilar.map((x) => `${k.ad(x.id)} ${sayiBicimi(x.tutar)}`).join(' · ')
        : ozet.karsilar.map((x) => `${yonelmeEki(k.ad(x.id))} ${sayiBicimi(x.tutar)}`).join(' · ');

  return (
    <View style={s.ekran}>
      <ScrollView contentContainerStyle={[s.icerik, { paddingTop: kenar.top + 12 }]} showsVerticalScrollIndicator={false}>
        <View style={s.ust}>
          <View style={{ flexShrink: 1 }}>
            <GeriHapi baslik={seyahatAdi(seyahat)} onPress={() => geziyeGit(seyahat.id)} duz />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.seyahattekiler')} onPress={() => setGrupAcik(true)} style={s.yuzler}>
            {uyeler.slice(0, 4).map((u, i) => (
              <View key={u.user_id} style={[s.yuz, i > 0 && { marginLeft: -8 }]}>
                <Avatar ad={u.display_name} url={u.photo_url} boyut={28} arkaPlan={k.renk(u.user_id)} />
              </View>
            ))}
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('harcama.baslik')}
        </Text>

        {hatirlatmaVakti(seyahat, an) ? <HatirlatmaSatiri ozet={ozet} k={k} ibanlar={ibanlar.data} onBakiyeler={bakiyeler} /> : null}

        {/* KK1: Gece özet kartı */}
        <View style={s.gece}>
          <View style={s.geceUst}>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.geceEtiket}>{t('harcama.toplamKisi', { n: kisiSayisi })}</Text>
              <Text style={s.geceSayi}>{paraMetni(ozet.toplam)}</Text>
              <Text style={s.geceAlt}>{t('harcama.kisiBasi', { tutar: yaklasikPara(ozet.toplam / kisiSayisi) })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
              <Text style={s.geceEtiket}>{t('harcama.seninDurumun')}</Text>
              <Text style={[s.geceSayi, ozet.benimNet > 0 && { color: ACIK_YESIL }, ozet.benimNet < 0 && { color: ACIK_KIRMIZI }]}>{paraMetni(ozet.benimNet, 'TRY', true)}</Text>
              {durumAlt ? (
                <Text style={[s.geceAlt, { textAlign: 'right' }]} numberOfLines={2}>
                  {durumAlt}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={s.geceDugmeler}>
            <Pressable accessibilityRole="button" onPress={bakiyeler} style={({ pressed }) => [s.dugme, { flex: 1, backgroundColor: renk.vurgu }, pressed && { opacity: 0.85 }]}>
              <Ikon ad="kisiler" boyut={16} renk={renk.metin} kalinlik={2.3} />
              <Text style={[s.dugmeMetin, { color: renk.metin }]}>{t('harcama.bakiyeler')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setOzetAcik(true)} style={({ pressed }) => [s.dugme, { flex: 0.6, backgroundColor: BEYAZ_14 }, pressed && { opacity: 0.85 }]}>
              <Text style={[s.dugmeMetin, { color: renk.zemin }]}>{t('harcama.ozetDugme')}</Text>
            </Pressable>
          </View>
        </View>

        {/* KK2: filtre */}
        {harcamalar.length > 0 ? (
          <SegmentSecici
            buyuk
            secenekler={[
              { deger: 'tumu', etiket: t('harcama.filtre.tumu', { n: harcamalar.length }) },
              { deger: 'benim', etiket: t('harcama.filtre.benim', { n: benim.length }) },
              { deger: 'kategori', etiket: t('harcama.filtre.kategori') },
            ]}
            deger={filtre}
            onDeger={setFiltre}
          />
        ) : null}
        {filtre === 'kategori' && kategoriSayilari.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {kategoriSayilari.map(({ kat, n }) => (
              <Cip key={kat} kucuk baslik={`${t(`harcama.kategori.${kat}`)} · ${n}`} secili={kat === seciliKategori} onPress={() => setKategori(kat)} />
            ))}
          </ScrollView>
        ) : null}

        {harcamalar.length === 0 ? (
          <View style={s.bos}>
            <View style={s.bosIkon}>
              <Ikon ad="cuzdan" boyut={26} renk={renk.ana} kalinlik={2.2} />
            </View>
            <Text style={s.bosBaslik}>{t('harcama.bosBaslik')}</Text>
            <Text style={s.bosMetin}>{t('harcama.bosMetin')}</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {gruplar.map((g) => (
              <View key={g.tarih} style={{ gap: 8 }}>
                <View style={s.gunBaslik}>
                  <Text style={s.gunMetin}>
                    {GUNLER[haftaGunu(g.tarih)].toLocaleUpperCase('tr')} {parcala(g.tarih).gun}
                  </Text>
                  <Text style={s.gunMetin}>{paraMetni(g.toplam)}</Text>
                </View>
                {g.harcamalar.map((h) => (
                  <HarcamaSatiri key={h.id} h={h} benId={benId} k={k} onPress={() => setForm({ harcama: h })} />
                ))}
              </View>
            ))}
            <Text style={s.dipnot}>{t('harcama.dipnot')}</Text>
          </View>
        )}
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.ekle')} onPress={() => setForm({ harcama: null })} style={({ pressed }) => [s.fab, pressed && { opacity: 0.9 }]}>
        <Ikon ad="arti" boyut={18} renk={renk.metin} kalinlik={3} />
        <Text style={s.fabMetin}>{t('harcama.fab')}</Text>
      </Pressable>

      {bildirim ? (
        <View style={s.bildirim} pointerEvents="none">
          <Text style={s.bildirimMetin}>{bildirim}</Text>
        </View>
      ) : null}

      <HarcamaFormu acik={!!form} onKapat={() => setForm(null)} seyahat={seyahat} uyeler={uyeler} harcama={form?.harcama ?? null} onBildirim={bildir} />
      <OzetPenceresi acik={ozetAcik} onKapat={() => setOzetAcik(false)} harcamalar={harcamalar} k={k} benId={benId} />
      <GrupPenceresi acik={grupAcik} onKapat={() => setGrupAcik(false)} seyahat={seyahat} uyeler={uyeler} mekanlar={mekanlar} />
    </View>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.haritaZemin },
  icerik: { paddingHorizontal: 20, paddingBottom: 110, gap: 12 },
  ust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  yuzler: { flexDirection: 'row' },
  yuz: { borderRadius: 11, borderWidth: 2, borderColor: renk.zemin },
  baslik: { fontFamily: yazi.baslik, fontSize: 28, letterSpacing: -0.84, color: renk.metin },
  gece: { padding: 14, borderRadius: 20, backgroundColor: renk.ana, gap: 12 },
  geceUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  geceEtiket: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.anaAcik },
  geceSayi: { fontFamily: yazi.baslik, fontSize: 28, letterSpacing: -0.84, color: renk.zemin },
  geceAlt: { fontFamily: yazi.normal, fontSize: 12, color: renk.anaAcik },
  geceDugmeler: { flexDirection: 'row', gap: 8 },
  dugme: { height: 38, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dugmeMetin: { fontFamily: yazi.ekstra, fontSize: 14, lineHeight: 16 },
  gunBaslik: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, paddingHorizontal: 2 },
  gunMetin: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.5, color: renk.ikincil },
  dipnot: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil, textAlign: 'center', paddingTop: 6 },
  bos: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  bosIkon: { width: 60, height: 60, borderRadius: 18, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  bosBaslik: { fontFamily: yazi.baslik, fontSize: 18, color: renk.metin },
  bosMetin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 20, color: renk.ikincil, textAlign: 'center', maxWidth: 300 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    height: 52,
    paddingLeft: 14,
    paddingRight: 18,
    borderRadius: 16,
    backgroundColor: renk.vurgu,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: renk.metin,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  fabMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  bildirim: { position: 'absolute', left: 20, right: 20, bottom: 84, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: renk.metin },
  bildirimMetin: { fontFamily: yazi.yari, fontSize: 14, color: renk.zemin, textAlign: 'center' },
});
