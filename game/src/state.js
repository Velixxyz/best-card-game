// The duel itself, with no DOM in it: two sides, turns, mana, life, shield,
// poison, the Surge and Advantage bonuses, and the win/loss/draw verdict.
// The renderer reads this state; the fuzz harness drives it headlessly.

import { CARD_BY_ID, suitBeats } from './cards.js';
import { createPiles, drawCards } from './deck.js';
import { createRandom } from './random.js';

export const START_LIFE = 50;
export const START_HAND = 4;
export const MAX_MANA = 10;
export const MAX_TURNS = 80;
export const SURGE_BONUS = 2;
export const ADVANTAGE_BONUS = 2;

export const PHASE_TITLE = 'title';
export const PHASE_PLAYER = 'player';
export const PHASE_AI = 'ai';
export const PHASE_OVER = 'over';

function createSide(random, startHand) {
  const piles = createPiles(random);
  return {
    life: START_LIFE,
    mana: 0,
    maxMana: 0,
    shield: 0,
    poison: 0,
    hand: drawCards(random, piles, startHand),
    piles,
    suitsPlayed: [],
    lastSuit: null,
    damageDealt: 0,
    cardsPlayed: 0,
  };
}

export function createGame(seed) {
  const random = createRandom(seed);
  return {
    seed,
    random,
    turn: 1,
    phase: PHASE_TITLE,
    // The rival moves second, so it opens with one extra card, as in most
    // duelling card games: tempo for the first player, cards for the second.
    player: createSide(random, START_HAND),
    rival: createSide(random, START_HAND + 1),
    winner: null,
    log: [],
    lastPlay: null,
  };
}

export function startDuel(game) {
  game.phase = PHASE_PLAYER;
  game.turn = 1;
  beginTurn(game, game.player);
  pushLog(game, 'The duel begins. Your move — play a card, then end your turn.');
}

function pushLog(game, message) {
  game.log.unshift(message);
  if (game.log.length > 6) game.log.length = 6;
}

// A side's turn opens: old shield fades, poison ticks (through shield),
// mana grows by one up to the cap, and one card is drawn.
export function beginTurn(game, side) {
  side.shield = 0;
  if (side.poison > 0) {
    const tick = side.poison;
    side.life = Math.max(0, side.life - tick);
    side.poison = Math.max(0, side.poison - 1);
    pushLog(game, `${side === game.player ? 'You take' : 'Rival takes'} ${tick} poison.`);
  }
  side.maxMana = Math.min(MAX_MANA, side.maxMana + 1);
  side.mana = side.maxMana;
  side.suitsPlayed = [];
  const drawn = drawCards(game.random, side.piles, 1);
  if (drawn.length > 0) {
    side.hand.push(drawn[0]);
    pushLog(game, `${side === game.player ? 'You draw' : 'Rival draws'} a card.`);
  }
  checkEnd(game);
}

export function canPlay(game, side, cardId) {
  if (game.phase === PHASE_OVER) return false;
  if (game.phase === PHASE_PLAYER && side !== game.player) return false;
  if (game.phase === PHASE_AI && side !== game.rival) return false;
  const card = CARD_BY_ID[cardId];
  if (!card) return false;
  if (!side.hand.includes(cardId)) return false;
  return side.mana >= card.cost;
}

// Resolve one card. Returns the resolved play for the renderer, or null
// when the card cannot be played.
export function playCard(game, side, cardId) {
  if (!canPlay(game, side, cardId)) return null;
  const other = side === game.player ? game.rival : game.player;
  const card = CARD_BY_ID[cardId];
  const surge = side.suitsPlayed.includes(card.suit);
  const advantage = card.damage > 0 && suitBeats(card.suit, other.lastSuit);
  const bonus = surge ? SURGE_BONUS : 0;

  side.hand.splice(side.hand.indexOf(cardId), 1);
  side.piles.discard.push(cardId);
  side.mana -= card.cost;
  side.suitsPlayed.push(card.suit);
  side.lastSuit = card.suit;
  side.cardsPlayed += 1;

  const resolved = {
    card,
    by: side === game.player ? 'player' : 'rival',
    surge,
    advantage,
    damage: 0,
    shield: 0,
    heal: 0,
    poison: 0,
    draw: 0,
  };

  if (card.damage) {
    let damage = card.damage + bonus + (advantage ? ADVANTAGE_BONUS : 0);
    const absorbed = Math.min(other.shield, damage);
    other.shield -= absorbed;
    damage -= absorbed;
    other.life = Math.max(0, other.life - damage);
    side.damageDealt += damage;
    resolved.damage = damage;
  }
  if (card.shield) {
    side.shield += card.shield + bonus;
    resolved.shield = card.shield + bonus;
  }
  if (card.heal) {
    side.life = Math.min(START_LIFE, side.life + card.heal + bonus);
    resolved.heal = card.heal + bonus;
  }
  if (card.poison) {
    other.poison += card.poison + bonus;
    resolved.poison = card.poison + bonus;
  }
  if (card.draw) {
    const drawn = drawCards(game.random, side.piles, card.draw);
    side.hand.push(...drawn);
    resolved.draw = drawn.length;
  }
  if (card.self) {
    side.life = Math.max(0, side.life - card.self);
  }

  game.lastPlay = resolved;
  pushLog(game, describePlay(resolved));
  checkEnd(game);
  return resolved;
}

function describePlay(play) {
  const who = play.by === 'player' ? 'You play' : 'Rival plays';
  const bits = [`${who} ${play.card.name}`];
  if (play.damage) bits.push(`— ${play.damage} damage`);
  if (play.shield) bits.push(`— ${play.shield} shield`);
  if (play.heal) bits.push(`— ${play.heal} ember`);
  if (play.poison) bits.push(`— poison ${play.poison}`);
  if (play.draw) bits.push(`— draws ${play.draw}`);
  if (play.surge) bits.push('(SURGE +2)');
  if (play.advantage) bits.push('(ADVANTAGE +2)');
  return bits.join(' ');
}

// End the current side's turn and open the other side's. Returns 'player'
// or 'rival' for whose turn it now is.
export function endTurn(game) {
  if (game.phase === PHASE_OVER) return null;
  if (game.phase === PHASE_PLAYER) {
    game.phase = PHASE_AI;
    beginTurn(game, game.rival);
    return 'rival';
  }
  game.phase = PHASE_PLAYER;
  game.turn += 1;
  beginTurn(game, game.player);
  return 'player';
}

function checkEnd(game) {
  if (game.phase === PHASE_OVER) return;
  const playerDead = game.player.life <= 0;
  const rivalDead = game.rival.life <= 0;
  if (playerDead && rivalDead) {
    game.winner = 'draw';
  } else if (rivalDead) {
    game.winner = 'player';
  } else if (playerDead) {
    game.winner = 'rival';
  } else if (game.turn > MAX_TURNS) {
    game.winner =
      game.player.life === game.rival.life
        ? 'draw'
        : game.player.life > game.rival.life
          ? 'player'
          : 'rival';
  }
  if (game.winner) {
    game.phase = PHASE_OVER;
    pushLog(
      game,
      game.winner === 'player'
        ? 'Victory! The rival ember fades.'
        : game.winner === 'rival'
          ? 'Defeat. Your ember fades.'
          : 'A draw — both embers burn low together.',
    );
  }
}
