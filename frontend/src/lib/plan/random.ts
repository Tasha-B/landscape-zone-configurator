// Deterministic randomness: the same seed always gives the same sequence,
// so generated artwork does not change between renders or reloads.

// FNV-1a, 32 bit
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: tiny, fast and good enough for visual jitter (not for crypto)
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns numbers in [0, 1)
export function createRandom(seed: string): () => number {
  return mulberry32(hashString(seed));
}
