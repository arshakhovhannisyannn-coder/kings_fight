// Seeded PRNG (mulberry32). All randomness in engine and AI goes through this.

/** Advance the uint32 state stored in holder.rng and return a float in [0, 1). */
export function rngNext(holder) {
  let t = (holder.rng = (holder.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Create a standalone generator function from a seed. */
export function makeRng(seed) {
  const holder = { rng: seed | 0 };
  return () => rngNext(holder);
}

/** Fisher–Yates shuffle (in place) using rnd(). */
export function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** Mix several integers into one seed (for deriving per-turn AI seeds). */
export function mixSeed(...nums) {
  let h = 0x9E3779B9 | 0;
  for (const n of nums) {
    h ^= (n | 0) + 0x9E3779B9 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
  }
  return h | 0;
}
