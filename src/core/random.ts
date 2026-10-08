/**
 * Aleator determinist. Nimic din motor nu folosește Math.random() sau timpul real:
 * valorile vin din (sămânță, cheie, cadru), deci aceeași randare dă aceleași pixeli.
 */

/** Hash FNV-1a pe 32 de biți pentru șiruri. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generator mulberry32: rapid, 32 de biți, perioadă 2^32. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un număr în [0, 1) determinat complet de cheie. */
export function rand(...key: Array<string | number>): number {
  return mulberry32(hashString(key.join("|")))();
}

/** Un generator pornit dintr-o cheie compusă. */
export function rng(...key: Array<string | number>): () => number {
  return mulberry32(hashString(key.join("|")));
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Zgomot de valoare 1D, neted, în [-1, 1]. */
export function noise1(seed: string, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = rand(seed, i) * 2 - 1;
  const b = rand(seed, i + 1) * 2 - 1;
  return a + (b - a) * fade(f);
}

/** Zgomot fractal 1D (câteva octave) pentru mișcare organică (handheld, plutire). */
export function fbm1(seed: string, x: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(`${seed}:${o}`, x * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
