// The draw pile: build a 30-card deck (two copies of every card in the
// catalogue), shuffle it, draw from it, and reshuffle the discard pile back
// in when it runs dry, so a long duel never stalls on an empty deck.

import { CARD_LIST } from './cards.js';
import { shuffleInPlace } from './random.js';

export function buildDeck(random) {
  const cards = [];
  for (const card of CARD_LIST) {
    cards.push(card.id, card.id);
  }
  return shuffleInPlace(random, cards);
}

export function createPiles(random) {
  return { deck: buildDeck(random), discard: [] };
}

// Draw up to `count` cards; reshuffles the discard pile when the deck runs
// out. Returns the ids actually drawn (fewer than asked only when both piles
// are empty, which cannot happen while cards are in play).
export function drawCards(random, piles, count) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (piles.deck.length === 0) {
      if (piles.discard.length === 0) break;
      piles.deck = shuffleInPlace(random, piles.discard);
      piles.discard = [];
    }
    drawn.push(piles.deck.pop());
  }
  return drawn;
}
