// #184 KK1 · KK4 (kanvas 26): sohbetin parçaları — tarih ayracı, balon (benim mesajım sağda Gece, diğerleri solda beyaz + avatar ve
// ad; altında saat ve kendi mesajımda "okundu"), gri ortalı sistem satırı ("Mert Kurşunlu Külliyesi'ni 2. güne taşıdı · Geri al").
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

export function TarihAyraci({ metin }: { metin: string }) {
  return (
    <View style={s.ayrac}>
      <Text style={s.ayracMetin}>{metin}</Text>
    </View>
  );
}

type BalonProps = {
  benim: boolean;
  ad: string;
  avatarRenk: string;
  foto: string | null;
  /** Aynı kişinin art arda mesajlarında avatar ve ad yalnız ilkinde. */
  ust: boolean;
  metin: string;
  silindi: boolean;
  saat: string;
  okundu: boolean;
  /** Mekan kartı, oylama, fotoğraf. */
  ek?: ReactNode;
  onUzunBas?: () => void;
};

export function MesajBalonu({ benim, ad, avatarRenk, foto, ust, metin, silindi, saat, okundu, ek, onUzunBas }: BalonProps) {
  const metinVar = silindi || metin.trim().length > 0;
  const govde = (
    <View style={[s.sutun, { alignItems: benim ? 'flex-end' : 'flex-start' }]}>
      {metinVar ? (
        <View style={[s.balon, benim ? s.benim : s.diger]}>
          {!benim && ust ? <Text style={s.ad}>{ad}</Text> : null}
          <Text style={[s.metin, benim && { color: renk.zemin }, silindi && s.silindi]}>{silindi ? t('sohbet.silindi') : metin}</Text>
        </View>
      ) : !benim && ust ? (
        <Text style={[s.ad, { marginLeft: 2 }]}>{ad}</Text>
      ) : null}
      {!silindi ? ek : null}
      <Text style={s.saat}>{okundu ? `${saat} · ${t('sohbet.okundu')}` : saat}</Text>
    </View>
  );
  return (
    <Pressable onLongPress={onUzunBas} delayLongPress={350} disabled={!onUzunBas} accessibilityHint={onUzunBas ? t('sohbet.uzunBas') : undefined}>
      {benim ? (
        govde
      ) : (
        <View style={s.satir}>
          <View style={{ width: 28 }}>{ust ? <Avatar ad={ad} url={foto} boyut={28} arkaPlan={avatarRenk} /> : null}</View>
          {govde}
        </View>
      )}
    </Pressable>
  );
}

export function SistemSatiri({ kim, cumle, geriAl, onGeriAl }: { kim: string; cumle: string; geriAl: boolean; onGeriAl: () => void }) {
  return (
    <Text style={s.sistem}>
      <Text style={s.kalin}>{kim}</Text> {cumle}
      {geriAl ? (
        <>
          {' · '}
          <Text accessibilityRole="button" onPress={onGeriAl} style={s.geriAl}>
            {t('davet.grup.geriAl')}
          </Text>
        </>
      ) : null}
    </Text>
  );
}

const s = StyleSheet.create({
  ayrac: { alignSelf: 'center', height: 24, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#e4e8f3', justifyContent: 'center' },
  ayracMetin: { fontFamily: yazi.ekstra, fontSize: 11, color: renk.ikincil },
  satir: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  sutun: { gap: 4, maxWidth: 290 },
  balon: { maxWidth: 280, paddingVertical: 10, paddingHorizontal: 12 },
  benim: { backgroundColor: renk.ana, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  diger: { backgroundColor: renk.zemin, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 4 },
  ad: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ana, marginBottom: 2 },
  metin: { fontFamily: yazi.normal, fontSize: 14, lineHeight: 19, color: renk.metin },
  silindi: { fontStyle: 'italic', color: renk.soluk },
  saat: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  sistem: { alignSelf: 'center', maxWidth: 300, textAlign: 'center', fontFamily: yazi.normal, fontSize: 12, lineHeight: 16, color: renk.ikincil },
  kalin: { fontFamily: yazi.ekstra },
  geriAl: { fontFamily: yazi.ekstra, color: renk.ana },
});
