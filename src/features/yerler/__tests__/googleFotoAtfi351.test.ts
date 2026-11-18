// #351 KK1: places-light ilk fotoğrafın yazarıyla birlikte `authorAttributions.uri`'yi de döndürür (yalnız bellekte, PRD §7).
import { describe, expect, it } from '@jest/globals';

import { fotoAtfi } from '../../../../supabase/functions/_shared/fotoAtfi';

describe('#351 KK1 fotoAtfi', () => {
  it('ad ve https bağlantısı birlikte döner', () => {
    expect(fotoAtfi({ displayName: ' Ali ', uri: 'https://maps.google.com/maps/contrib/1' })).toEqual({ foto_yazar: 'Ali', foto_yazar_uri: 'https://maps.google.com/maps/contrib/1' });
  });
  it('https olmayan ya da boş bağlantı null; ad yoksa bağlantı da yok', () => {
    expect(fotoAtfi({ displayName: 'Ali', uri: 'javascript:alert(1)' })).toEqual({ foto_yazar: 'Ali', foto_yazar_uri: null });
    expect(fotoAtfi({ displayName: 'Ali' })).toEqual({ foto_yazar: 'Ali', foto_yazar_uri: null });
    expect(fotoAtfi({ uri: 'https://maps.google.com/maps/contrib/1' })).toEqual({ foto_yazar: null, foto_yazar_uri: null });
    expect(fotoAtfi(undefined)).toEqual({ foto_yazar: null, foto_yazar_uri: null });
  });
});
