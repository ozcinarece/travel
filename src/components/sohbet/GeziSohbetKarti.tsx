// #184 KK10 (kanvas 23 · 23b): Gezi sayfasındaki "Sohbet" bölümü — açık oylama varsa o (soru, seçenek sayıları, "Oy ver"), yoksa son
// mesaj ("Yanıtla"); altında "Sohbete git · N yeni". Hiç mesaj yoksa tek satır davet. Adlar DB / oturum önbelleğinden (Google yok).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BolumBasligi, geziStil, Kart } from '@/components/gezi/GeziParcalari';
import { Avatar } from '@/components/ui/Avatar';
import type { Kisiler } from '@/features/harcama/metin';
import type { Mesaj, Oylama } from '@/features/sohbet/sohbet';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = {
  /** Gösterilecek mesaj: açık oylamanın mesajı ya da son mesaj. */
  mesaj: Mesaj | null;
  oylama: Oylama | null;
  saat: string;
  okunmamis: number;
  k: Kisiler;
  benId: string | null;
  /** Mekan mesajının adı (DB / önbellek; bilinmiyorsa kategori). */
  mekanAdi: (placeId: string) => string;
  onAc: () => void;
};

export function GeziSohbetKarti({ mesaj, oylama, saat, okunmamis, k, benId, mekanAdi, onAc }: Props) {
  const metin = !mesaj
    ? ''
    : oylama
      ? mesaj.metin.trim() || oylama.soru
      : mesaj.tur === 'mekan' && mesaj.place_id
        ? [mesaj.metin.trim(), `📍 ${mekanAdi(mesaj.place_id)}`].filter(Boolean).join(' ')
        : mesaj.tur === 'foto'
          ? [mesaj.metin.trim(), `📷 ${t('sohbet.ek.foto')}`].filter(Boolean).join(' ')
          : mesaj.metin;
  const git = okunmamis > 0 ? t('sohbet.gezi.gitYeni', { n: okunmamis }) : t('sohbet.gezi.git');
  return (
    <View style={{ gap: 10 }}>
      <BolumBasligi baslik={t('seyahatMenusu.sohbet')} baglanti={t('sohbet.gezi.ac')} onBaglanti={onAc} />
      <Kart>
        {mesaj ? (
          <>
            <View style={s.ust}>
              {mesaj.user_id ? <Avatar ad={k.ad(mesaj.user_id)} url={k.foto(mesaj.user_id)} boyut={28} arkaPlan={k.renk(mesaj.user_id)} /> : null}
              <Text style={s.ad} numberOfLines={1}>
                {mesaj.user_id === benId ? t('harcama.form.sen') : mesaj.user_id ? k.ad(mesaj.user_id) : ''}
              </Text>
              <Text style={s.saat}>{saat}</Text>
            </View>
            <Text style={s.metin} numberOfLines={3}>
              {metin}
            </Text>
            {oylama ? (
              <View style={s.secenekler}>
                {[...oylama.oylama_secenekleri]
                  .sort((a, b) => a.sira - b.sira)
                  .map((sc) => (
                    <View key={sc.id} style={s.secenek}>
                      <Text style={s.secenekMetin} numberOfLines={1}>
                        {sc.metin} · {oylama.oylama_oylari.filter((v) => v.secenek_id === sc.id).length}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={s.bos}>{t('sohbet.gezi.bos')}</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {mesaj ? (
            <Pressable accessibilityRole="button" onPress={onAc} style={({ pressed }) => [geziStil.dugme, { flex: 1, backgroundColor: renk.ana }, pressed && { opacity: 0.85 }]}>
              <Text style={[geziStil.dugmeMetin, { color: renk.zemin }]}>{oylama ? t('sohbet.gezi.oyVer') : t('sohbet.gezi.yanitla')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onAc} style={({ pressed }) => [geziStil.dugme, { flex: 1, backgroundColor: renk.yuzey }, pressed && { opacity: 0.85 }]}>
            <Text style={[geziStil.dugmeMetin, { color: renk.ana }]}>{git}</Text>
          </Pressable>
        </View>
      </Kart>
    </View>
  );
}

const s = StyleSheet.create({
  ust: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ad: { flex: 1, fontFamily: yazi.ekstra, fontSize: 13, color: renk.metin },
  saat: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  metin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 19, color: renk.metin },
  secenekler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  secenek: { height: 28, paddingHorizontal: 10, borderRadius: 9, backgroundColor: renk.yuzey, justifyContent: 'center', maxWidth: '100%' },
  secenekMetin: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana },
  bos: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
});
