import { describe, expect, it, jest } from '@jest/globals';

import { sahipMi, seyahatYokMu, silmeMetni } from '../silme';

jest.mock('@react-native-async-storage/async-storage', () => ({ removeItem: jest.fn(async () => undefined) }));

describe('#174 seyahat silme', () => {
  const uyeler = [
    { user_id: 's', role: 'owner' as const },
    { user_id: 'u', role: 'member' as const },
  ];
  it('KK1–KK2: silme yalnız sahipte; üye ve oturumsuz için yok', () => {
    expect(sahipMi(uyeler, 's')).toBe(true);
    expect(sahipMi(uyeler, 'u')).toBe(false);
    expect(sahipMi(uyeler, undefined)).toBe(false);
  });
  it('KK3: onay metni — tek başına kalıcılık, başkaları varsa kişi sayısı', () => {
    expect(silmeMetni(1)).toBe('Plan, listen ve tüm günler kalıcı olarak silinir. Bu geri alınamaz.');
    expect(silmeMetni(3)).toBe('2 kişi daha bu seyahatte; silersen onlar için de silinir. Bu geri alınamaz.');
    expect(silmeMetni(0)).toBe(silmeMetni(1));
  });
  it('KK5: tek seyahat sorgusunda satır yoksa (PGRST116) silinmiş sayılır; ağ hatası sayılmaz', () => {
    expect(seyahatYokMu({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })).toBe(true);
    expect(seyahatYokMu(new Error('Network request failed'))).toBe(false);
    expect(seyahatYokMu(null)).toBe(false);
  });
});
