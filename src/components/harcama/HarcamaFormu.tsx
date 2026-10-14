// #183 KK4 (kanvas 25b): "Harcama ekle" alt penceresi — büyük tutar + para birimi (TRY dışında elle kur, ₺ karşılığı canlı),
// açıklama, kategori çipleri, durağa bağla (Plan'dan açılınca dolu; değiştirilebilir), ödeyen (varsayılan sen), bölüşüm (Eşit ·
// Tutar · Pay; kişi başına onay kutusu ve hesaplanan pay), fiş fotoğrafı, Kaydet. Kuruş farkı ödeyene yazılır. Var olan harcama
// aynı formda açılır: ekleyen ya da sahip düzenler/siler, diğer üyeler yalnız görür. Seçimler (para birimi, ödeyen, durak)
// iç içe pencere açmadan formun içinde açılır.
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Avatar } from '@/components/ui/Avatar';
import { Cip } from '@/components/ui/Cip';
import { Ikon } from '@/components/ui/Ikon';
import { SegmentSecici } from '@/components/ui/SegmentSecici';
import { CekilenSayfa, modalKokuStili, SayfaKaydirici, SayfaMetinAlani } from '@/components/ui/sayfaCekme';
import { mekanAdi, gunEtiketi } from '@/features/gezi/geziOzeti';
import { useBilinenMekanlar } from '@/features/gezi/bilinenMekanlar';
import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import {
  bolusumOzeti,
  KATEGORILER,
  kurAyristir,
  paraMetni,
  paraSecenekleri,
  paraSimgesi,
  paylariHesapla,
  sonKur,
  tlKarsiligi,
  tlyeCevir,
  tutarAyristir,
  tutarMetni,
  type BolusumModu,
  type Harcama,
  type HarcamaKategorisi,
} from '@/features/harcama/hesap';
import { kisiler as kisiKaynagi } from '@/features/harcama/metin';
import { fisSecVeYukle, useFisAdresi, useHarcamaKaydet, useHarcamalar, useHarcamaSil } from '@/features/harcama/sorgular';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import type { Seyahat, Uye } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

import { durakKategorisi } from './kategori';

type Props = {
  acik: boolean;
  onKapat: () => void;
  seyahat: Pick<Seyahat, 'id' | 'country_code'>;
  uyeler: Uye[];
  /** Açılan harcama (yoksa yeni). */
  harcama?: Harcama | null;
  /** Plan'dan açılınca bağlanacak durak. */
  durakId?: string | null;
  onBildirim?: (metin: string) => void;
};

const KREM = '#fff6e6';

export function HarcamaFormu(p: Props) {
  return (
    <Modal visible={p.acik} transparent animationType="slide" onRequestClose={p.onKapat}>
      <GestureHandlerRootView style={modalKokuStili}>
        <KeyboardAvoidingView style={s.perde} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={p.onKapat} accessibilityLabel={t('harcama.form.kapat')} />
          <CekilenSayfa onKapat={p.onKapat} style={s.sayfa}>
            <View style={s.tutamac} />
            {/* Üyeler gelmeden form açılmaz (bölüşüm kişileri ilk çizimde belirlenir). */}
            {p.acik ? p.uyeler.length ? <FormIcerigi key={`${p.harcama?.id ?? 'yeni'}:${p.durakId ?? ''}`} {...p} /> : <ActivityIndicator style={{ margin: 40 }} color={renk.ana} /> : null}
          </CekilenSayfa>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

type Acilan = 'para' | 'odeyen' | 'durak' | null;

function FormIcerigi({ onKapat, seyahat, uyeler, harcama, durakId, onBildirim }: Props) {
  const { session } = useOturum();
  const benId = session?.user.id ?? '';
  const k = useMemo(() => kisiKaynagi(uyeler), [uyeler]);
  const harcamalar = useHarcamalar(seyahat.id);
  const duraklar = useDuraklar(seyahat.id);
  const gunler = useGunler(seyahat.id);
  const mekanlar = useMekanlar(seyahat.id);
  const bilinen = useBilinenMekanlar(useMemo(() => (mekanlar.data ?? []).map((m) => m.place_id), [mekanlar.data]));
  const kaydet = useHarcamaKaydet(seyahat.id);
  const sil = useHarcamaSil(seyahat.id);

  const benSahip = uyeler.some((u) => u.user_id === benId && u.role === 'owner');
  const salt = !!harcama && harcama.olusturan !== benId && !benSahip;

  // Kişiler: üyeler + (düzenlemede) seyahatten ayrılmış ama bu harcamada payı olanlar.
  const kisiIdleri = useMemo(() => {
    const ids = uyeler.map((u) => u.user_id);
    for (const pay of harcama?.harcama_paylari ?? []) if (!ids.includes(pay.user_id)) ids.push(pay.user_id);
    if (harcama && !ids.includes(harcama.odeyen_id)) ids.push(harcama.odeyen_id);
    return ids;
  }, [uyeler, harcama]);

  const ilkDurak = harcama ? harcama.stop_id : (durakId ?? null);
  const durakMekani = (id: string | null) => {
    const d = id ? duraklar.data?.find((x) => x.id === id) : undefined;
    return d ? mekanlar.data?.find((m) => m.id === d.place_ref) : undefined;
  };

  const [tutarYazi, setTutarYazi] = useState(() => (harcama ? tutarMetni(harcama.tutar_kurus) : ''));
  const [para, setPara] = useState(harcama?.para_birimi ?? 'TRY');
  const [kurYazi, setKurYazi] = useState(() => (harcama && harcama.para_birimi !== 'TRY' ? String(Math.round((harcama.tl_kurus / harcama.tutar_kurus) * 10_000) / 10_000).replace('.', ',') : ''));
  const [aciklama, setAciklama] = useState(harcama?.aciklama ?? '');
  const [kategori, setKategori] = useState<HarcamaKategorisi>(() => harcama?.kategori ?? (durakId ? durakKategorisi(durakMekani(durakId)?.primary_type) : 'diger'));
  const [odeyen, setOdeyen] = useState(harcama?.odeyen_id ?? benId);
  const [durak, setDurak] = useState<string | null>(ilkDurak);
  const [fis, setFis] = useState<string | null>(harcama?.fis_yolu ?? null);
  const [fisYukleniyor, setFisYukleniyor] = useState(false);
  const [acilan, setAcilan] = useState<Acilan>(null);
  const [hata, setHata] = useState<string | null>(null);

  // Bölüşüm: düzenlemede paylar eşitse Eşit, değilse Tutar (harcama para biriminde; kuruş farkı ödeyene).
  const ilkBolusum = useMemo(() => {
    if (!harcama) return { mod: 'esit' as BolusumModu, secili: new Set(uyeler.map((u) => u.user_id)), tutarlar: {} as Record<string, string> };
    const secili = new Set(harcama.harcama_paylari.filter((x) => x.pay_kurus > 0).map((x) => x.user_id));
    const oz = bolusumOzeti(harcama.harcama_paylari, kisiIdleri);
    if (oz.tur !== 'farkli') return { mod: 'esit' as BolusumModu, secili, tutarlar: {} };
    const cevir = (pay: number) => Math.floor((pay * harcama.tutar_kurus) / harcama.tl_kurus);
    const tutarlar: Record<string, number> = {};
    for (const x of harcama.harcama_paylari) if (x.pay_kurus > 0) tutarlar[x.user_id] = cevir(x.pay_kurus);
    const fark = harcama.tutar_kurus - Object.values(tutarlar).reduce((a, b) => a + b, 0);
    const sahip = secili.has(harcama.odeyen_id) ? harcama.odeyen_id : [...secili][0];
    if (sahip) tutarlar[sahip] = (tutarlar[sahip] ?? 0) + fark;
    return { mod: 'tutar' as BolusumModu, secili, tutarlar: Object.fromEntries(Object.entries(tutarlar).map(([id, v]) => [id, tutarMetni(v)])) };
  }, [harcama, uyeler, kisiIdleri]);
  const [mod, setMod] = useState<BolusumModu>(ilkBolusum.mod);
  const [secili, setSecili] = useState<Set<string>>(ilkBolusum.secili);
  const [tutarlar, setTutarlar] = useState<Record<string, string>>(ilkBolusum.tutarlar);
  const [agirliklar, setAgirliklar] = useState<Record<string, number>>({});

  // ---------------------------------------------------------------- hesap
  const tutar = tutarAyristir(tutarYazi);
  const kur = para === 'TRY' ? 1 : kurAyristir(kurYazi);
  const tl = tutar && kur ? (para === 'TRY' ? tutar : tlKarsiligi(tutar, kur)) : null;
  const bolusumKisileri = kisiIdleri.map((id) => ({ id, secili: secili.has(id), tutar: tutarAyristir(tutarlar[id] ?? '') ?? 0, pay: agirliklar[id] ?? 1 }));
  const paylar = tutar ? paylariHesapla(tutar, mod, bolusumKisileri, odeyen) : null;
  const tlPaylar = paylar && tutar && tl && tl > 0 ? tlyeCevir(paylar, tutar, tl, odeyen) : null;
  const girilenToplam = bolusumKisileri.filter((x) => x.secili).reduce((a, x) => a + (x.tutar ?? 0), 0);
  const kalan = mod === 'tutar' && tutar ? tutar - girilenToplam : 0;
  const hazir = !salt && !!tutar && !!tl && !!tlPaylar && tlPaylar.size > 0 && !kaydet.isPending && !fisYukleniyor;

  const kaydetBas = () => {
    if (!hazir || !tutar || !tl || !tlPaylar) return;
    setHata(null);
    kaydet.mutate(
      {
        id: harcama?.id ?? null,
        aciklama: aciklama.trim(),
        tutar_kurus: tutar,
        para_birimi: para,
        tl_kurus: tl,
        kategori,
        odeyen_id: odeyen,
        stop_id: durak,
        fis_yolu: fis,
        paylar: [...tlPaylar].map(([user_id, pay_kurus]) => ({ user_id, pay_kurus })),
      },
      {
        onSuccess: () => {
          onBildirim?.(harcama ? t('harcama.form.guncellendi') : t('harcama.form.eklendi'));
          onKapat();
        },
        onError: () => setHata(t('harcama.form.kaydedilemedi')),
      },
    );
  };

  const silBas = async () => {
    if (!harcama) return;
    const onay = await onayIste(t('harcama.form.silBaslik'), t('harcama.form.silMetin'), t('harcama.form.sil'), t('genel.vazgec'));
    if (!onay) return;
    sil.mutate(harcama.id, {
      onSuccess: () => {
        onBildirim?.(t('harcama.form.silindi'));
        onKapat();
      },
      onError: () => setHata(t('harcama.form.kaydedilemedi')),
    });
  };

  const fisEkle = async () => {
    setFisYukleniyor(true);
    setHata(null);
    try {
      const yol = await fisSecVeYukle(seyahat.id);
      if (yol) setFis(yol);
    } catch {
      setHata(t('harcama.form.fisYuklenemedi'));
    } finally {
      setFisYukleniyor(false);
    }
  };
  const fisAdresi = useFisAdresi(fis);

  const paraSec = (yeni: string) => {
    setPara(yeni);
    setAcilan(null);
    if (yeni !== 'TRY' && !kurAyristir(kurYazi)) {
      const son = sonKur(harcamalar.data ?? [], yeni);
      setKurYazi(son ? String(son).replace('.', ',') : '');
    }
  };
  const kisiDegistir = (id: string) =>
    setSecili((e) => {
      const yeni = new Set(e);
      if (yeni.has(id)) yeni.delete(id);
      else yeni.add(id);
      return yeni;
    });
  const ac = (a: Acilan) => setAcilan((e) => (e === a ? null : a));
  const durakSec = (id: string | null) => {
    setDurak(id);
    setAcilan(null);
  };
  const odeyenSec = (id: string) => {
    setOdeyen(id);
    setAcilan(null);
  };
  // Tutar'a geçerken boş kutular o anki paylarla dolar (kişi yalnız farkı düzeltir).
  const modDegistir = (yeni: BolusumModu) => {
    if (yeni === 'tutar' && paylar && Object.keys(tutarlar).length === 0) {
      setTutarlar(Object.fromEntries([...paylar].map(([id, v]) => [id, tutarMetni(v)])));
    }
    setMod(yeni);
  };

  const siraliDuraklar = useMemo(() => {
    const gunIle = new Map((gunler.data ?? []).map((g) => [g.id, g]));
    return (duraklar.data ?? [])
      .filter((d) => !d.skipped)
      .map((d) => ({ d, g: gunIle.get(d.day_id) }))
      .sort((a, b) => (a.g?.index ?? 0) - (b.g?.index ?? 0) || (a.d.order_key < b.d.order_key ? -1 : 1));
  }, [duraklar.data, gunler.data]);
  const durakEtiketi = (id: string) => {
    const x = siraliDuraklar.find((y) => y.d.id === id);
    const m = durakMekani(id);
    const ad = m ? mekanAdi(m, bilinen.ad) : t('harcama.form.durak');
    return x?.g ? `${ad} · ${gunEtiketi(x.g)}` : ad;
  };

  const baslik = !harcama ? t('harcama.form.baslik') : salt ? t('harcama.form.gorBaslik') : t('harcama.form.duzenleBaslik');

  return (
    <SayfaKaydirici contentContainerStyle={s.icerik} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.ustSatir}>
        <Text accessibilityRole="header" style={s.baslik}>
          {baslik}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.form.kapat')} onPress={onKapat} hitSlop={8} style={s.kapat}>
          <Ikon ad="kapat" boyut={18} renk={renk.metin} kalinlik={2.4} />
        </Pressable>
      </View>

      {/* Tutar + para birimi */}
      <View style={s.tutarKutu}>
        <SayfaMetinAlani
          value={tutarYazi}
          onChangeText={setTutarYazi}
          placeholder="0"
          placeholderTextColor={renk.soluk}
          keyboardType="decimal-pad"
          autoFocus={!harcama}
          editable={!salt}
          accessibilityLabel={t('harcama.form.tutar')}
          style={s.tutarGirdi}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.form.paraBirimi')} disabled={salt} onPress={() => ac('para')} style={({ pressed }) => [s.paraDugme, pressed && { opacity: 0.8 }]}>
          <Text style={s.paraMetin}>
            {paraSimgesi(para)} {para}
          </Text>
        </Pressable>
      </View>
      {acilan === 'para' ? (
        <View style={s.ciplar}>
          {paraSecenekleri(seyahat.country_code).map((pb) => (
            <Cip key={pb} kucuk baslik={`${paraSimgesi(pb)} ${pb}`} secili={pb === para} onPress={() => paraSec(pb)} />
          ))}
        </View>
      ) : null}
      {para !== 'TRY' ? (
        <View style={s.kurSatiri}>
          <Text style={s.kurEtiket}>{t('harcama.form.kur', { para })}</Text>
          <SayfaMetinAlani
            value={kurYazi}
            onChangeText={setKurYazi}
            placeholder="0,00"
            placeholderTextColor={renk.soluk}
            keyboardType="decimal-pad"
            editable={!salt}
            accessibilityLabel={t('harcama.form.kurEtiketi', { para })}
            style={s.kurGirdi}
          />
          <Text style={s.kurEtiket}>₺</Text>
          <Text style={s.kurSonuc} numberOfLines={1}>
            {tl ? `≈ ${paraMetni(tl)}` : t('harcama.form.kurGir')}
          </Text>
        </View>
      ) : null}

      <SayfaMetinAlani
        value={aciklama}
        onChangeText={setAciklama}
        placeholder={t('harcama.form.aciklama')}
        placeholderTextColor={renk.soluk}
        maxLength={80}
        editable={!salt}
        accessibilityLabel={t('harcama.form.aciklama')}
        style={s.aciklama}
      />

      <View style={s.ciplar}>
        {KATEGORILER.map((kat) => (
          <Cip key={kat} kucuk baslik={t(`harcama.kategori.${kat}`)} secili={kategori === kat} onPress={() => !salt && setKategori(kat)} />
        ))}
      </View>

      {/* Durağa bağla */}
      {siraliDuraklar.length > 0 || durak ? (
        <View style={s.durak}>
          <Text style={s.durakMetin} numberOfLines={1}>
            {durak ? (
              <>
                <Text style={s.durakEtiket}>{t('harcama.form.duragaBagli')} </Text>
                {durakEtiketi(durak)}
              </>
            ) : (
              <Text style={s.durakEtiket}>{t('harcama.form.duragaBagla')}</Text>
            )}
          </Text>
          {!salt ? (
            <Pressable accessibilityRole="button" onPress={() => ac('durak')} hitSlop={8}>
              <Text style={s.degistir}>{durak ? t('harcama.form.degistir') : t('harcama.form.sec')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {acilan === 'durak' ? (
        <View style={s.secimListesi}>
          {durak ? (
            <Pressable accessibilityRole="button" onPress={() => durakSec(null)} style={s.secimSatiri}>
              <Text style={[s.secimMetin, { color: renk.ikincil }]}>{t('harcama.form.bagiKaldir')}</Text>
            </Pressable>
          ) : null}
          {siraliDuraklar.map(({ d }) => (
            <Pressable key={d.id} accessibilityRole="button" accessibilityState={{ selected: d.id === durak }} onPress={() => durakSec(d.id)} style={s.secimSatiri}>
              <Text style={[s.secimMetin, d.id === durak && { color: renk.ana }]} numberOfLines={1}>
                {durakEtiketi(d.id)}
              </Text>
              {d.id === durak ? <Ikon ad="tik" boyut={16} renk={renk.ana} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Ödeyen */}
      <View style={s.satir}>
        <Text style={s.etiket}>{t('harcama.form.odeyen')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.form.odeyenSec')} disabled={salt} onPress={() => ac('odeyen')} style={({ pressed }) => [s.odeyen, pressed && { opacity: 0.8 }]}>
          <Avatar ad={k.ad(odeyen)} url={k.foto(odeyen)} boyut={26} arkaPlan={k.renk(odeyen)} />
          <Text style={s.odeyenAd} numberOfLines={1}>
            {odeyen === benId ? t('harcama.form.sen') : k.ad(odeyen)}
          </Text>
          {!salt ? <Ikon ad="asagi" boyut={16} renk={renk.ikincil} kalinlik={2.4} /> : null}
        </Pressable>
      </View>
      {acilan === 'odeyen' ? (
        <View style={s.secimListesi}>
          {uyeler.map((u) => (
            <Pressable key={u.user_id} accessibilityRole="button" accessibilityState={{ selected: u.user_id === odeyen }} onPress={() => odeyenSec(u.user_id)} style={s.secimSatiri}>
              <Avatar ad={u.display_name} url={u.photo_url} boyut={26} arkaPlan={k.renk(u.user_id)} />
              <Text style={[s.secimMetin, u.user_id === odeyen && { color: renk.ana }]} numberOfLines={1}>
                {u.user_id === benId ? t('harcama.form.sen') : u.display_name}
              </Text>
              {u.user_id === odeyen ? <Ikon ad="tik" boyut={16} renk={renk.ana} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Bölüşüm */}
      <View style={{ gap: 10 }}>
        <Text style={s.etiket}>{t('harcama.form.bolusum')}</Text>
        {!salt ? (
          <SegmentSecici
            secenekler={[
              { deger: 'esit', etiket: t('harcama.form.esit') },
              { deger: 'tutar', etiket: t('harcama.form.tutarModu') },
              { deger: 'pay', etiket: t('harcama.form.payModu') },
            ]}
            deger={mod}
            onDeger={modDegistir}
          />
        ) : null}
        {kisiIdleri.map((id) => {
          const dahil = secili.has(id);
          const pay = paylar?.get(id) ?? 0;
          return (
            <View key={id} style={s.kisi}>
              <Avatar ad={k.ad(id)} url={k.foto(id)} boyut={32} arkaPlan={k.renk(id)} />
              <Text style={[s.kisiAd, !dahil && { color: renk.soluk }]} numberOfLines={1}>
                {id === benId ? t('harcama.form.sen') : k.ad(id)}
              </Text>
              {mod === 'tutar' && dahil && !salt ? (
                <SayfaMetinAlani
                  value={tutarlar[id] ?? ''}
                  onChangeText={(v) => setTutarlar((e) => ({ ...e, [id]: v }))}
                  placeholder="0"
                  placeholderTextColor={renk.soluk}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('harcama.form.kisiTutari', { ad: k.ad(id) })}
                  style={s.kisiGirdi}
                />
              ) : mod === 'pay' && dahil && !salt ? (
                <View style={s.agirlik}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.form.payAzalt', { ad: k.ad(id) })} hitSlop={6} onPress={() => setAgirliklar((e) => ({ ...e, [id]: Math.max(0, (e[id] ?? 1) - 1) }))} style={s.agirlikDugme}>
                    <Text style={s.agirlikIsaret}>−</Text>
                  </Pressable>
                  <Text style={s.agirlikSayi}>{agirliklar[id] ?? 1}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('harcama.form.payArtir', { ad: k.ad(id) })} hitSlop={6} onPress={() => setAgirliklar((e) => ({ ...e, [id]: Math.min(20, (e[id] ?? 1) + 1) }))} style={s.agirlikDugme}>
                    <Text style={s.agirlikIsaret}>+</Text>
                  </Pressable>
                </View>
              ) : null}
              {mod !== 'tutar' || salt ? (
                <Text style={[s.kisiPay, !dahil && { color: renk.soluk }]}>{dahil && pay ? paraMetni(pay, para) : '—'}</Text>
              ) : null}
              {!salt ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: dahil }}
                  accessibilityLabel={t('harcama.form.kisiSec', { ad: k.ad(id) })}
                  hitSlop={8}
                  onPress={() => kisiDegistir(id)}
                  style={[s.kutu, dahil && s.kutuSecili]}
                >
                  {dahil ? <Ikon ad="tik" boyut={14} renk={renk.zemin} kalinlik={2.6} /> : null}
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {mod === 'tutar' && tutar && kalan !== 0 && !salt ? (
          <Text style={[s.ipucu, { color: renk.uyari }]}>{kalan > 0 ? t('harcama.form.kalan', { tutar: paraMetni(kalan, para) }) : t('harcama.form.fazla', { tutar: paraMetni(-kalan, para) })}</Text>
        ) : null}
        {para !== 'TRY' && tl ? <Text style={s.ipucu}>{t('harcama.form.tlNotu', { tutar: paraMetni(tl) })}</Text> : null}
      </View>

      {fis && fisAdresi.data ? <Image source={{ uri: fisAdresi.data }} style={s.fisOnizleme} contentFit="cover" accessibilityLabel={t('harcama.form.fis')} /> : null}
      {hata ? <Text style={[s.ipucu, { color: renk.uyari }]}>{hata}</Text> : null}

      {!salt ? (
        <View style={s.altSatir}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fis ? t('harcama.form.fisDegistir') : t('harcama.form.fisEkle')}
            onPress={() => void fisEkle()}
            disabled={fisYukleniyor}
            style={({ pressed }) => [s.fisDugme, fis && s.fisVar, pressed && { opacity: 0.8 }]}
          >
            {fisYukleniyor ? <ActivityIndicator color={renk.ana} /> : <Ikon ad={fis ? 'tik' : 'kamera'} boyut={20} renk={fis ? renk.basariMetin : renk.ana} kalinlik={2.2} />}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!hazir} onPress={kaydetBas} style={({ pressed }) => [s.kaydet, !hazir && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
            {kaydet.isPending ? <ActivityIndicator color={renk.zemin} /> : <Text style={s.kaydetMetin}>{t('harcama.form.kaydet')}</Text>}
          </Pressable>
        </View>
      ) : (
        <Text style={s.ipucu}>{t('harcama.form.yalnizEkleyen')}</Text>
      )}
      {harcama && !salt ? (
        <Pressable accessibilityRole="button" onPress={() => void silBas()} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={s.sil}>{t('harcama.form.sil')}</Text>
        </Pressable>
      ) : null}
    </SayfaKaydirici>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.45)', justifyContent: 'flex-end' },
  sayfa: { backgroundColor: renk.zemin, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, maxHeight: '92%' },
  tutamac: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: renk.ayrac },
  icerik: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, gap: 14 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontFamily: yazi.baslik, fontSize: 22, letterSpacing: -0.5, color: renk.metin },
  kapat: { width: 36, height: 36, borderRadius: 12, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  tutarKutu: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: renk.yuzey },
  tutarGirdi: { flex: 1, fontFamily: yazi.baslik, fontSize: 36, letterSpacing: -1, color: renk.metin, paddingVertical: 0 },
  paraDugme: { height: 36, paddingHorizontal: 12, borderRadius: 11, backgroundColor: renk.zemin, justifyContent: 'center' },
  paraMetin: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.ana },
  kurSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kurEtiket: { fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  kurGirdi: { width: 96, height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: renk.yuzey, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  kurSonuc: { flex: 1, textAlign: 'right', fontFamily: yazi.ekstra, fontSize: 14, color: renk.ikincil },
  aciklama: { height: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: renk.yuzey, fontFamily: yazi.yari, fontSize: 15, color: renk.metin },
  ciplar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durak: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: KREM },
  durakMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  durakEtiket: { fontFamily: yazi.normal, color: renk.ikincil },
  degistir: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.ana },
  secimListesi: { borderRadius: 14, borderWidth: 1.5, borderColor: renk.ayrac, overflow: 'hidden' },
  secimSatiri: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: renk.ayrac },
  secimMetin: { flex: 1, fontFamily: yazi.kalin, fontSize: 14, color: renk.metin },
  satir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiket: { fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  odeyen: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 6, paddingRight: 10, borderRadius: 12, backgroundColor: renk.yuzey, maxWidth: '65%' },
  odeyenAd: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin, flexShrink: 1 },
  kisi: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  kisiAd: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  kisiPay: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  kisiGirdi: { width: 96, height: 38, paddingHorizontal: 10, borderRadius: 11, backgroundColor: renk.yuzey, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin, textAlign: 'right' },
  agirlik: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agirlikDugme: { width: 30, height: 30, borderRadius: 9, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  agirlikIsaret: { fontFamily: yazi.ekstra, fontSize: 16, color: renk.ana },
  agirlikSayi: { minWidth: 18, textAlign: 'center', fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  kutu: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: renk.ayrac, alignItems: 'center', justifyContent: 'center' },
  kutuSecili: { backgroundColor: renk.ana, borderColor: renk.ana },
  ipucu: { fontFamily: yazi.yari, fontSize: 12, color: renk.ikincil },
  fisOnizleme: { height: 140, borderRadius: 14, backgroundColor: renk.yuzey },
  altSatir: { flexDirection: 'row', gap: 10, marginTop: 4 },
  fisDugme: { width: 48, height: 48, borderRadius: 14, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  fisVar: { backgroundColor: renk.basariZemin },
  kaydet: { flex: 1, height: 48, borderRadius: 14, backgroundColor: renk.ana, alignItems: 'center', justifyContent: 'center' },
  kaydetMetin: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.zemin },
  sil: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.uyari },
});
