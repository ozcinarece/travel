/** "450 m" / "3,2 km" (bacak hapları, kartta kalan yol). */
export function mesafeMetni(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}
