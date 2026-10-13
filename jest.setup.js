/* global jest */
// AsyncStorage'ın yerel modülü jest'te yok: resmi bellek içi taklit (izler son hata kaydı, içerik place_id önbelleği, supabase oturumu).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// #164: gesture-handler jestleri (alt sayfaların içerikten çekilmesi) jest ortamında taklit edilir.
require('react-native-gesture-handler/jestSetup');
