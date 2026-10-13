// İçerik hattı (docs/07): araştırma sonucunun şifrelenmesi. Sonuç oturumun açık anahtarıyla şifrelenir — RSA-OAEP-SHA256
// ile sarılmış AES-256-GCM — ve herkese açık repoda geçici bir dalda durur; yalnız özel anahtarın sahibi (oturum) çözer.
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
export const ALG = 'RSA-OAEP-SHA256+AES-256-GCM';

const b64 = (tampon) => Buffer.from(tampon).toString('base64');
const ham = (metin) => Buffer.from(metin, 'base64');

/** PEM ya da tek satır base64 → DER. */
export function derAl(anahtar) {
  const govde = String(anahtar ?? '')
    .replace(/-----(BEGIN|END) [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(govde)) throw new Error('anahtar base64 değil');
  return ham(govde);
}

export async function anahtarCifti() {
  const cift = await subtle.generateKey({ ...RSA, modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['encrypt', 'decrypt']);
  const acik = b64(await subtle.exportKey('spki', cift.publicKey));
  const ozel = b64(await subtle.exportKey('pkcs8', cift.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${ozel.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
  return { acik, ozelPem: pem };
}

export async function sifrele(metin, acikAnahtar) {
  const rsa = await subtle.importKey('spki', derAl(acikAnahtar), RSA, false, ['encrypt']);
  const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const veri = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(metin));
  const sarili = await subtle.encrypt(RSA, rsa, await subtle.exportKey('raw', aes));
  return { surum: 1, alg: ALG, anahtar: b64(sarili), iv: b64(iv), veri: b64(veri) };
}

export async function coz(paket, ozelPem) {
  if (paket?.surum !== 1 || paket.alg !== ALG) throw new Error('tanınmayan paket');
  const rsa = await subtle.importKey('pkcs8', derAl(ozelPem), RSA, false, ['decrypt']);
  const anahtar = await subtle.decrypt(RSA, rsa, ham(paket.anahtar));
  const aes = await subtle.importKey('raw', anahtar, { name: 'AES-GCM' }, false, ['decrypt']);
  const metin = await subtle.decrypt({ name: 'AES-GCM', iv: ham(paket.iv) }, aes, ham(paket.veri));
  return new TextDecoder().decode(metin);
}
