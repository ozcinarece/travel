/* global jest */
// AsyncStorage'ın yerel modülü jest'te yok: resmi bellek içi taklit (icerik/sorgular place_id önbelleği, supabase oturumu).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
