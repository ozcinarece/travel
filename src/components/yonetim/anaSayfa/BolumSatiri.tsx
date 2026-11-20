import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AKIS_AMACLARI } from '@/features/icerik/amaclar';
import { kapakAtfiOku } from '@/features/icerik/kapakAtfi';
import {
  BANNER_HEDEF_TURLERI,
  bannerAdresiGecerli,
  bannerIcerigi,
  BOLUM_TURLERI,
  bolumOzeti,
  eskiTurMu,
  icerikDoluMu,
  icerikTuru,
  icerikYaz,
  RAF_TURLERI,
  rafIcerigi,
  seciliIdler,
  V6_TURLERI,
  v6BosIcerik,
  type BannerUyarisi,
  type TaslakBolum,
} from '@/features/yonetim/anaSayfa';
import { tasi, yerelTarihGirdisi, yerelTarihtenIso } from '@/features/yonetim/gezi';
import { ty } from '@/features/yonetim/metin';
import { t } from '@/i18n';
import type { BannerHedefi, BolumKaynagi, BolumTuru } from '@/lib/anaSayfa';
import { yazi } from '@/theme';

import { Alan, AlanSatiri, MetinKutusu, SecimKutusu, TarihKutusu } from '../Form';
import { Hap } from '../Hap';
import { useSuruklenen } from '../surukle';
import { yRenk } from '../tema';

type Adli = { id: string; ad: string };
export type IcerikSecenekleri = {
  geziler: readonly { id: string; baslik: string }[];
  yerler: readonly Adli[];
  sehirler: readonly Adli[];
  /** #406 2/2: banner hedefi olabilecek raf bölümleri (taslaktaki). */
  raflar?: readonly Adli[];
  /** #438 inceleme 8: gezi listesi henüz gelmedi ("Geziler yükleniyor"). */
  gezilerYukleniyor?: boolean;
};

type Props = {
  bolum: TaslakBolum;
  indeks: number;
  secenekler: IcerikSecenekleri;
  acik: boolean;
  onAcKapa: () => void;
  onGuncelle: (alanlar: Partial<Omit<TaslakBolum, 'id'>>) => void;
  onSil: () => void;
  onBirak: (kaynak: number, hedef: number) => void;
  /** #438 inceleme 1 ve 4: banner uygulamada neden görünmüyor ('ikinci': gri, "görünmez"). */
  uyari?: BannerUyarisi | null;
  /** #438 inceleme 2: kaydedilmemiş görsel var mı (sayfa Yayınla'yı durdurur). */
  onKirli?: (kirli: boolean) => void;
};

const TUTAMAC = 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01';

/**
 * KK3 (kanvas ekran 3 satırı): 16 px tutamaç (sürükle = sıra), başlık + "· tür", alt satırda içerik ve kaynak, 38 × 22
 * anahtar (açık/kapalı), "Düzenle". Düzenleyici kanvasta yok (tasarım bekliyor): alan kutusu ve satır stiliyle.
 */
export function BolumSatiri({ bolum, indeks, secenekler, acik, onAcKapa, onGuncelle, onSil, onBirak, uyari = null, onKirli }: Props) {
  const ref = useRef<View>(null);
  // #438 inceleme 4: banner listenin başında sabit (uygulamada hep rafların üstünde); tutamaç yok, sürüklenmez.
  const sabit = bolum.tur === 'banner';
  useSuruklenen(ref, 'ana-sayfa', indeks, onBirak, !sabit);
  const [kirli, setKirli] = useState(false);
  const kirliDegis = (k: boolean) => {
    setKirli(k);
    onKirli?.(k);
  };
  // #406 2/2 (#428 soru 6): eski türler v6 Keşfet'te çizilmez; panelde gri durur. İkinci banner da gri (#438 inceleme 4).
  const eski = eskiTurMu(bolum.tur);
  const ikinci = uyari === 'ikinci';
  return (
    <View style={[s.kap, (eski || ikinci) && s.eski]} testID={`bolum-${bolum.id}`}>
      <View ref={ref} style={s.satir}>
        {sabit ? null : (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={yRenk.yerTutucu} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <Path d={TUTAMAC} />
          </Svg>
        )}
        <View style={s.metinler}>
          <Text style={s.baslik} numberOfLines={1}>
            {bolum.baslik}
            <Text style={s.tur}>{` · ${ty(`anaSayfa.tur.${bolum.tur}`)}`}</Text>
          </Text>
          <Text style={s.ozet} numberOfLines={1}>
            {bolumOzeti(bolum, secenekler, ty)}
          </Text>
          {uyari === 'hedefYayinda' || uyari === 'rafAz' ? (
            <Text style={s.hata} numberOfLines={1}>
              {ty(`anaSayfa.uyari.${uyari}`)}
            </Text>
          ) : null}
          {kirli ? (
            <Text style={s.hata} numberOfLines={1}>
              {ty('anaSayfa.gorselKaydedilmedi')}
            </Text>
          ) : null}
        </View>
        {eski ? <Text style={s.eskiEtiket}>{ty('anaSayfa.v6Gorunmez')}</Text> : null}
        {ikinci ? <Text style={s.eskiEtiket}>{ty('anaSayfa.gorunmez')}</Text> : null}
        <Anahtar acik={bolum.acik} etiket={ty('anaSayfa.acikKapali', { baslik: bolum.baslik })} onDegis={(a) => onGuncelle({ acik: a })} />
        <Hap kucuk baslik={ty(acik ? 'anaSayfa.kapat' : 'anaSayfa.duzenle')} onPress={onAcKapa} />
      </View>
      {/* Kaydedilmemiş görsel varken düzenleyici kapanınca da yazılanlar kalsın: gizlenir, sökülmez. */}
      {acik || kirli ? (
        <View style={acik ? null : s.gizli}>
          <Duzenleyici bolum={bolum} secenekler={secenekler} onGuncelle={onGuncelle} onSil={onSil} onKirli={kirliDegis} />
        </View>
      ) : null}
    </View>
  );
}

/** Kanvas anahtarı: 38 × 22; açık siyah, düğme sağda; kapalı #d9d9d4, düğme solda. */
export function Anahtar({ acik, etiket, onDegis }: { acik: boolean; etiket: string; onDegis: (a: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={etiket} accessibilityState={{ checked: acik }} onPress={() => onDegis(!acik)} style={[s.anahtar, { backgroundColor: acik ? yRenk.metin : yRenk.cerceve }]}>
      <View style={[s.dugme, acik ? { right: 3 } : { left: 3 }]} />
    </Pressable>
  );
}

function Duzenleyici({
  bolum,
  secenekler,
  onGuncelle,
  onSil,
  onKirli,
}: {
  bolum: TaslakBolum;
  secenekler: IcerikSecenekleri;
  onGuncelle: Props['onGuncelle'];
  onSil: () => void;
  onKirli: (kirli: boolean) => void;
}) {
  const [baslik, setBaslik] = useState(bolum.baslik);
  const [silOnay, setSilOnay] = useState(false);
  // #438 inceleme 3: içerik doluyken tür değişimi silme gibi ikinci seçimle onaylanır.
  const [bekleyenTur, setBekleyenTur] = useState<'banner' | 'raf' | null>(null);
  const tur = icerikTuru(bolum.tur);
  const liste: Adli[] = tur === 'gezi' ? secenekler.geziler.map((g) => ({ id: g.id, ad: g.baslik })) : tur === 'yer' ? [...secenekler.yerler] : [...secenekler.sehirler];
  const secili = seciliIdler(bolum);
  const kalan = liste.filter((x) => !secili.includes(x.id));
  const yaz = (idler: string[]) => onGuncelle({ icerik: icerikYaz(bolum.tur, idler) });
  const elleSecim = bolum.kaynak === 'elle' || bolum.tur === 'sehir_seckisi';
  // #406 2/2: banner ve raf kendi düzenleyicisinde; eski türlerin alanları (tür, kaynak, içerik) bunlarda gösterilmez.
  const v6 = bolum.tur === 'banner' || bolum.tur === 'raf';

  return (
    <View style={s.duzenleyici}>
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.baslik')}>
          <MetinKutusu value={baslik} onChangeText={setBaslik} onBlur={() => baslik.trim() && baslik !== bolum.baslik && onGuncelle({ baslik: baslik.trim() })} maxLength={80} accessibilityLabel={ty('anaSayfa.alan.baslik')} />
        </Alan>
        {v6 ? (
          <Alan etiket={ty('anaSayfa.alan.tur')} genislik={150}>
            <SecimKutusu<'banner' | 'raf'>
              etiket={ty('anaSayfa.alan.tur')}
              deger={bolum.tur as 'banner' | 'raf'}
              onDegis={(yeni) => {
                if (yeni === bolum.tur) return setBekleyenTur(null);
                if (icerikDoluMu(bolum) && bekleyenTur !== yeni) return setBekleyenTur(yeni);
                setBekleyenTur(null);
                onGuncelle({ tur: yeni, kaynak: 'elle', icerik: v6BosIcerik(yeni) });
              }}
              secenekler={V6_TURLERI.map((x) => ({ deger: x, etiket: ty(`anaSayfa.turAd.${x}`) }))}
            />
          </Alan>
        ) : (
          <Alan etiket={ty('anaSayfa.alan.tur')} genislik={150}>
            <SecimKutusu<BolumTuru>
              etiket={ty('anaSayfa.alan.tur')}
              deger={bolum.tur}
              onDegis={(t) => onGuncelle({ tur: t, icerik: icerikYaz(t, []), kaynak: t === 'sehir_seckisi' ? 'elle' : bolum.kaynak })}
              secenekler={BOLUM_TURLERI.map((t) => ({ deger: t, etiket: ty(`anaSayfa.turAd.${t}`) }))}
            />
          </Alan>
        )}
        {!v6 && bolum.tur !== 'sehir_seckisi' ? (
          <Alan etiket={ty('anaSayfa.alan.kaynak')} genislik={120}>
            <SecimKutusu<BolumKaynagi>
              etiket={ty('anaSayfa.alan.kaynak')}
              deger={bolum.kaynak}
              onDegis={(kaynak) => onGuncelle({ kaynak })}
              secenekler={[
                { deger: 'otomatik', etiket: ty('anaSayfa.kaynak.otomatik') },
                { deger: 'elle', etiket: ty('anaSayfa.kaynak.elle') },
              ]}
            />
          </Alan>
        ) : null}
      </AlanSatiri>
      {bekleyenTur ? (
        <Text accessibilityRole="alert" style={s.hata}>
          {ty('anaSayfa.turDegisOnay')}
        </Text>
      ) : null}
      {bolum.tur === 'raf' ? <RafAlanlari bolum={bolum} secenekler={secenekler} onGuncelle={onGuncelle} /> : null}
      {bolum.tur === 'banner' ? <BannerAlanlari key={bolum.id} bolum={bolum} secenekler={secenekler} onGuncelle={onGuncelle} onKirli={onKirli} /> : null}
      {!v6 && elleSecim ? (
        <Alan etiket={ty('anaSayfa.alan.icerik')}>
          <View style={s.secililer}>
            {secili.map((id, i) => (
              <IcerikSatiri key={id} id={id} indeks={i} bolumId={bolum.id} ad={liste.find((x) => x.id === id)?.ad ?? id} onCikar={() => yaz(secili.filter((x) => x !== id))} onBirak={(k, h) => yaz(tasi(secili, k, h))} />
            ))}
            {(bolum.tur !== 'tek_kart' || secili.length === 0) && kalan.length ? (
              <SecimKutusu
                etiket={ty('anaSayfa.alan.ekle')}
                deger=""
                onDegis={(id) => id && yaz(bolum.tur === 'tek_kart' ? [id] : [...secili, id])}
                secenekler={[{ deger: '', etiket: ty('anaSayfa.ekleSec') }, ...kalan.map((x) => ({ deger: x.id, etiket: x.ad }))]}
              />
            ) : null}
          </View>
        </Alan>
      ) : null}
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.baslangic')} genislik={220}>
          <TarihKutusu etiket={ty('anaSayfa.alan.baslangic')} deger={yerelTarihGirdisi(bolum.baslangic_at)} onDegis={(g) => onGuncelle({ baslangic_at: yerelTarihtenIso(g) })} />
        </Alan>
        <Alan etiket={ty('anaSayfa.alan.bitis')} genislik={220}>
          <TarihKutusu etiket={ty('anaSayfa.alan.bitis')} deger={yerelTarihGirdisi(bolum.bitis_at)} onDegis={(g) => onGuncelle({ bitis_at: yerelTarihtenIso(g) })} />
        </Alan>
        <View style={s.sil}>
          <Hap kucuk baslik={ty(silOnay ? 'anaSayfa.silOnay' : 'anaSayfa.sil')} onPress={() => (silOnay ? onSil() : setSilOnay(true))} />
        </View>
      </AlanSatiri>
    </View>
  );
}

/** #406 2/2 KK4: rafın içeriği — amaç, şehir ya da elle seçilmiş geziler (sürükle = sıra). */
function RafAlanlari({ bolum, secenekler, onGuncelle }: { bolum: TaslakBolum; secenekler: IcerikSecenekleri; onGuncelle: Props['onGuncelle'] }) {
  const i = bolum.icerik;
  const rafTuru = i.raf_turu === 'amac' || i.raf_turu === 'sehir' ? i.raf_turu : 'elle';
  const secili = i.gezi_idler ?? [];
  const geziAd = (id: string) => secenekler.geziler.find((g) => g.id === id)?.baslik ?? id;
  const kalan = secenekler.geziler.filter((g) => !secili.includes(g.id));
  const yaz = (idler: string[]) => onGuncelle({ icerik: rafIcerigi('elle', { gezi_idler: idler }) });
  return (
    <>
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.rafTuru')} genislik={170}>
          <SecimKutusu<(typeof RAF_TURLERI)[number]>
            etiket={ty('anaSayfa.alan.rafTuru')}
            deger={rafTuru}
            onDegis={(x) => x !== rafTuru && onGuncelle({ icerik: rafIcerigi(x) })}
            secenekler={RAF_TURLERI.map((x) => ({ deger: x, etiket: ty(`anaSayfa.rafTuru.${x}`) }))}
          />
        </Alan>
        {rafTuru === 'amac' ? (
          <Alan etiket={ty('anaSayfa.alan.amac')}>
            <SecimKutusu
              etiket={ty('anaSayfa.alan.amac')}
              deger={i.amac ?? ''}
              onDegis={(a) => onGuncelle({ icerik: rafIcerigi('amac', { amac: a || undefined }) })}
              secenekler={[{ deger: '', etiket: ty('anaSayfa.ekleSec') }, ...AKIS_AMACLARI.map((a) => ({ deger: a, etiket: t(`kesfetAkisi.amac.${a}`) }))]}
            />
          </Alan>
        ) : null}
        {rafTuru === 'sehir' ? (
          <Alan etiket={ty('anaSayfa.alan.sehir')}>
            <SecimKutusu
              etiket={ty('anaSayfa.alan.sehir')}
              deger={i.sehir_id ?? ''}
              onDegis={(id) => onGuncelle({ icerik: rafIcerigi('sehir', { sehir_id: id || undefined }) })}
              secenekler={[{ deger: '', etiket: ty('anaSayfa.ekleSec') }, ...secenekler.sehirler.map((x) => ({ deger: x.id, etiket: x.ad }))]}
            />
          </Alan>
        ) : null}
      </AlanSatiri>
      {rafTuru === 'elle' ? (
        <Alan etiket={ty('anaSayfa.alan.icerik')}>
          <View style={s.secililer}>
            {secili.map((id, n) => (
              <IcerikSatiri key={id} id={id} indeks={n} bolumId={bolum.id} ad={geziAd(id)} onCikar={() => yaz(secili.filter((x) => x !== id))} onBirak={(k, h) => yaz(tasi(secili, k, h))} />
            ))}
            {secenekler.gezilerYukleniyor ? (
              <Text style={s.not}>{ty('anaSayfa.gezilerYukleniyor')}</Text>
            ) : kalan.length && secili.length < 30 ? (
              <SecimKutusu
                etiket={ty('anaSayfa.alan.ekle')}
                deger=""
                onDegis={(id) => id && yaz([...secili, id])}
                secenekler={[{ deger: '', etiket: ty('anaSayfa.ekleSec') }, ...kalan.map((g) => ({ deger: g.id, etiket: g.baslik }))]}
              />
            ) : null}
          </View>
        </Alan>
      ) : null}
      <Text style={s.not}>{ty('anaSayfa.rafNotu')}</Text>
    </>
  );
}

/**
 * #406 2/2 KK4: banner — üst yazı, hedef (gezi, şehir ya da raf) ve görsel. Görsel boşsa uygulama hedefin Commons kapağını
 * kullanır. Görsel adresi yalnız Commons ya da kendi kovamızdan (KK-ek1); atıfsız görsel kaydedilmez (DB kuralı).
 */
function BannerAlanlari({
  bolum,
  secenekler,
  onGuncelle,
  onKirli,
}: {
  bolum: TaslakBolum;
  secenekler: IcerikSecenekleri;
  onGuncelle: Props['onGuncelle'];
  onKirli: (kirli: boolean) => void;
}) {
  const i = bolum.icerik;
  const atif = kapakAtfiOku(i.kapak_atif);
  const [ustYazi, setUstYazi] = useState(i.ust_yazi ?? '');
  const [adres, setAdres] = useState(i.kapak_url ?? '');
  const [yazar, setYazar] = useState(atif?.yazar ?? '');
  const [lisans, setLisans] = useState(atif?.lisans ?? '');
  const [kaynak, setKaynak] = useState(atif?.kaynak_url ?? '');
  // #438 inceleme 5: hata hangi alana aitse kırmızı kenar orada.
  const [gorselHata, setGorselHata] = useState<{ alan: 'adres' | 'yazar' | 'kaynak'; metin: string } | null>(null);
  // #438 inceleme 2: yazılan görsel alanları kayıtlı olandan farklıysa "Görsel kaydedilmedi".
  const kirli =
    adres.trim() !== (i.kapak_url ?? '') ||
    (!!adres.trim() && (yazar.trim() !== (atif?.yazar ?? '') || lisans.trim() !== (atif?.lisans ?? '') || kaynak.trim() !== (atif?.kaynak_url ?? '')));
  const kirliBildir = useEffectEvent((k: boolean) => onKirli(k));
  useEffect(() => kirliBildir(kirli), [kirli]);
  // #438 inceleme 2 (3. tur): tür rafa dönünce ya da banner alanları sökülünce yazılan görsel gider; "kaydedilmemiş" kalmasın.
  const kirliTemizle = useEffectEvent(() => onKirli(false));
  useEffect(() => () => kirliTemizle(), []);
  const yaz = (degisen: Parameters<typeof bannerIcerigi>[1]) => onGuncelle({ icerik: bannerIcerigi(i, degisen) });
  // Hedef türü yerel: tür seçilip henüz öğe seçilmeden DB'ye hedefsiz yazılır (hedef = tür + kimlik).
  const [hedefTuru, setHedefTuru] = useState<BannerHedefi['tur'] | ''>(i.hedef?.tur ?? '');
  const hedefListe: readonly Adli[] =
    hedefTuru === 'gezi' ? secenekler.geziler.map((g) => ({ id: g.id, ad: g.baslik })) : hedefTuru === 'sehir' ? secenekler.sehirler : hedefTuru === 'raf' ? (secenekler.raflar ?? []) : [];

  const gorselKaydet = () => {
    const a = adres.trim();
    if (!a) {
      setGorselHata(null);
      yaz({ kapak_url: undefined, kapak_atif: undefined });
      return;
    }
    if (!bannerAdresiGecerli(a)) return setGorselHata({ alan: 'adres', metin: ty('anaSayfa.gorselAdresHata') });
    if (!yazar.trim()) return setGorselHata({ alan: 'yazar', metin: ty('anaSayfa.gorselAtifHata') });
    const k = kaynak.trim();
    if (k && !/^https:\/\//.test(k)) return setGorselHata({ alan: 'kaynak', metin: ty('anaSayfa.gorselKaynakHata') });
    setGorselHata(null);
    yaz({ kapak_url: a, kapak_atif: { yazar: yazar.trim(), ...(lisans.trim() ? { lisans: lisans.trim() } : {}), ...(k ? { kaynak_url: k } : {}) } });
  };
  const gorselKaldir = () => {
    setAdres('');
    setYazar('');
    setLisans('');
    setKaynak('');
    setGorselHata(null);
    yaz({ kapak_url: undefined, kapak_atif: undefined });
  };

  return (
    <>
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.ustYazi')} genislik={200}>
          <MetinKutusu
            value={ustYazi}
            onChangeText={setUstYazi}
            onBlur={() => ustYazi.trim() !== (i.ust_yazi ?? '') && yaz({ ust_yazi: ustYazi })}
            maxLength={40}
            placeholder={ty('anaSayfa.ustYaziOrnek')}
            accessibilityLabel={ty('anaSayfa.alan.ustYazi')}
          />
        </Alan>
        <Alan etiket={ty('anaSayfa.alan.hedefTuru')} genislik={150}>
          <SecimKutusu<BannerHedefi['tur'] | ''>
            etiket={ty('anaSayfa.alan.hedefTuru')}
            deger={hedefTuru}
            onDegis={(x) => {
              if (x === hedefTuru) return;
              setHedefTuru(x);
              if (i.hedef) yaz({ hedef: undefined });
            }}
            secenekler={[{ deger: '', etiket: ty('anaSayfa.ekleSec') }, ...BANNER_HEDEF_TURLERI.map((x) => ({ deger: x, etiket: ty(`anaSayfa.v6Ozet.hedef.${x}`) }))]}
          />
        </Alan>
      </AlanSatiri>
      <HedefSecimi
        tur={hedefTuru}
        hedef={i.hedef ?? null}
        liste={hedefListe}
        onSec={(tur, id) => yaz({ hedef: id ? { tur, id } : undefined })}
      />
      <Alan etiket={ty('anaSayfa.alan.gorsel')}>
        <MetinKutusu
          value={adres}
          onChangeText={(x) => {
            setAdres(x);
            setGorselHata(null);
          }}
          hatali={gorselHata?.alan === 'adres'}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://upload.wikimedia.org/…"
          accessibilityLabel={ty('anaSayfa.alan.gorsel')}
        />
      </Alan>
      <AlanSatiri>
        <Alan etiket={ty('anaSayfa.alan.atifYazar')}>
          <MetinKutusu value={yazar} onChangeText={setYazar} hatali={gorselHata?.alan === 'yazar'} maxLength={200} accessibilityLabel={ty('anaSayfa.alan.atifYazar')} />
        </Alan>
        <Alan etiket={ty('anaSayfa.alan.atifLisans')} genislik={150}>
          <MetinKutusu value={lisans} onChangeText={setLisans} maxLength={60} placeholder="CC BY-SA 4.0" accessibilityLabel={ty('anaSayfa.alan.atifLisans')} />
        </Alan>
      </AlanSatiri>
      <Alan etiket={ty('anaSayfa.alan.atifKaynak')}>
        <MetinKutusu value={kaynak} onChangeText={setKaynak} hatali={gorselHata?.alan === 'kaynak'} maxLength={500} autoCapitalize="none" autoCorrect={false} placeholder="https://commons.wikimedia.org/wiki/File:…" accessibilityLabel={ty('anaSayfa.alan.atifKaynak')} />
      </Alan>
      {gorselHata ? (
        <Text accessibilityRole="alert" style={s.hata}>
          {gorselHata.metin}
        </Text>
      ) : null}
      <View style={s.gorselEylem}>
        <Hap kucuk baslik={ty('anaSayfa.gorselKaydet')} onPress={gorselKaydet} />
        {/* #438 inceleme 3 (3. tur): Yayınla uyarısı bu düğmeyi gösteriyor; kaydedilmemiş görsel varken de görünür. */}
        {i.kapak_url || kirli ? <Hap kucuk baslik={ty('anaSayfa.gorselKaldir')} onPress={gorselKaldir} /> : null}
      </View>
      <Text style={s.not}>{ty('anaSayfa.bannerNotu')}</Text>
    </>
  );
}

function HedefSecimi({ tur, hedef, liste, onSec }: { tur: BannerHedefi['tur'] | ''; hedef: BannerHedefi | null; liste: readonly Adli[]; onSec: (tur: BannerHedefi['tur'], id: string) => void }) {
  if (!tur) return null;
  return (
    <Alan etiket={ty('anaSayfa.alan.hedef')}>
      <SecimKutusu
        etiket={ty('anaSayfa.alan.hedef')}
        deger={hedef?.tur === tur ? hedef.id : ''}
        onDegis={(id) => onSec(tur, id)}
        secenekler={[{ deger: '', etiket: ty('anaSayfa.ekleSec') }, ...liste.map((x) => ({ deger: x.id, etiket: x.ad }))]}
      />
    </Alan>
  );
}

function IcerikSatiri({ id, indeks, bolumId, ad, onCikar, onBirak }: { id: string; indeks: number; bolumId: string; ad: string; onCikar: () => void; onBirak: (k: number, h: number) => void }) {
  const ref = useRef<View>(null);
  useSuruklenen(ref, `icerik-${bolumId}`, indeks, onBirak);
  return (
    <View ref={ref} style={s.icerikSatir}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={yRenk.yerTutucu} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d={TUTAMAC} />
      </Svg>
      <Text style={s.icerikAd} numberOfLines={1}>
        {ad}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={ty('anaSayfa.cikar', { ad })} onPress={onCikar} hitSlop={8}>
        <Text style={s.carpi}>×</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { borderRadius: 12, borderWidth: 1, borderColor: yRenk.ayrac, backgroundColor: yRenk.zemin },
  eski: { opacity: 0.55 },
  gizli: { display: 'none' },
  eskiEtiket: { fontFamily: yazi.kalin, fontSize: 11, color: yRenk.ikincil },
  hata: { fontFamily: yazi.yari, fontSize: 11.5, color: yRenk.hata },
  gorselEylem: { flexDirection: 'row', gap: 8 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  metinler: { flex: 1, minWidth: 0, gap: 2 },
  baslik: { fontFamily: yazi.ekstra, fontSize: 13, color: yRenk.metin },
  tur: { fontFamily: yazi.kalin, fontSize: 11, color: yRenk.ikincil },
  ozet: { fontFamily: yazi.yari, fontSize: 12, color: yRenk.ikincil },
  not: { fontFamily: yazi.normal, fontSize: 12, color: yRenk.ikincil },
  anahtar: { width: 38, height: 22, borderRadius: 999 },
  dugme: { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: yRenk.zemin },
  duzenleyici: { gap: 12, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: yRenk.ayrac, paddingTop: 12 },
  secililer: { gap: 6 },
  icerikSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: yRenk.ayrac },
  icerikAd: { flex: 1, fontFamily: yazi.kalin, fontSize: 12.5, color: yRenk.metin },
  carpi: { fontFamily: yazi.normal, fontSize: 12.5, color: yRenk.ikincil },
  sil: { justifyContent: 'flex-end', marginLeft: 'auto' },
});
