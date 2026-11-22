// A small seeded random source (mulberry32) so a game can be replayed from
// one number: screenshots use a fixed seed, fuzz tests sweep many seeds, and
// a real game just seeds from the clock.

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(bound) {
      return Math.floor(this.next() * bound);
    },
  };
}

// Fisher-Yates, in place, driven by the game's own random source.
export function shuffleInPlace(random, array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = random.int(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
