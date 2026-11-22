// The rival's brain: a greedy value player that reads the table. It scores
// every card it can afford, plays the best value first, and keeps playing
// while mana remains. It also shows its hand: chooseOpening picks the card it
// will lead with, so the renderer can telegraph it and the player can answer
// with a shield instead of guessing.

import { CARD_BY_ID } from './cards.js';
import { canPlay } from './state.js';

// One number for a card in this position: damage and poison hit hardest,
// a draw keeps the engine going, a shield is worth more when the player is
// about to hit hard, a heal is worth most while hurt, and a pact's self
// damage is a real cost.
export function scoreCard(game, side, cardId) {
  const other = side === game.player ? game.rival : game.player;
  const card = CARD_BY_ID[cardId];
  let value = 0;
  if (card.damage) {
    value += card.damage * 1.0;
    if (card.damage >= other.life) value += 50;
  }
  if (card.poison) value += card.poison * 1.5;
  if (card.shield) value += card.shield * (other.damageDealt > 0 ? 0.9 : 0.6);
  if (card.heal) value += card.heal * (side.life < 18 ? 1.0 : 0.3);
  if (card.draw) value += card.draw * 2.5;
  if (card.self) value -= card.self * 1.5;
  // Same-suit Surge makes a second card of that suit worth more.
  if (side.suitsPlayed.includes(card.suit)) value += 2.5;
  return value / Math.max(1, card.cost);
}

// The best card the side can afford right now, or null when it should stop.
export function chooseNextCard(game, side) {
  let best = null;
  let bestValue = 0;
  for (const cardId of side.hand) {
    if (!canPlay(game, side, cardId)) continue;
    const value = scoreCard(game, side, cardId);
    if (value > bestValue) {
      bestValue = value;
      best = cardId;
    }
  }
  return best;
}

// The card the rival will lead with, chosen before its turn is shown, so the
// player sees the plan coming and can shield or race it.
export function chooseOpening(game) {
  return chooseNextCard(game, game.rival);
}
