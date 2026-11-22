// Deterministic staged scenes for screenshots: ?shot=title|table|win|loss
// with &seed=N builds the same table every time, paints it twice, and sets
// window.__shotReady so a screenshot tool knows the frame is settled. These
// are real renders of the game's own code, not composites: the table scene
// plays six real turns through the state machine first.

import { createGame, startDuel, playCard, endTurn, PHASE_OVER } from './state.js';
import { chooseNextCard } from './ai.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './render.js';

// Play a few real turns so the table shot shows a lived-in game: hands,
// discard piles, a last-played card, log lines, mid-game life totals.
function playRealTurns(game, turns) {
  for (let i = 0; i < turns; i += 1) {
    if (game.phase === PHASE_OVER) break;
    let guard = 0;
    let cardId = chooseNextCard(game, game.player);
    while (cardId && guard < 12) {
      playCard(game, game.player, cardId);
      guard += 1;
      cardId = chooseNextCard(game, game.player);
    }
    if (game.phase === PHASE_OVER) break;
    endTurn(game);
    guard = 0;
    cardId = chooseNextCard(game, game.rival);
    while (cardId && guard < 12) {
      playCard(game, game.rival, cardId);
      guard += 1;
      cardId = chooseNextCard(game, game.rival);
    }
    if (game.phase === PHASE_OVER) break;
    endTurn(game);
  }
}

export function stageShot(name, seed) {
  if (name === 'title') {
    return { game: createGame(seed), screen: SCREEN_TITLE };
  }
  if (name === 'table') {
    const game = createGame(seed);
    startDuel(game);
    playRealTurns(game, 3);
    return { game, screen: SCREEN_PLAY };
  }
  if (name === 'win' || name === 'loss') {
    const game = createGame(seed);
    startDuel(game);
    playRealTurns(game, 3);
    // Force the verdict honestly through the state machine: set the loser's
    // life to 1, then play the strongest damaging card the winner can afford.
    const loser = name === 'win' ? game.rival : game.player;
    const winnerSide = name === 'win' ? game.player : game.rival;
    loser.life = 1;
    loser.shield = 0;
    winnerSide.mana = 10;
    winnerSide.maxMana = 10;
    let played = false;
    for (const id of [...winnerSide.hand]) {
      const before = loser.life;
      const result = playCard(game, winnerSide, id);
      if (result && result.damage > 0 && loser.life < before) {
        played = true;
        break;
      }
      if (game.phase === PHASE_OVER) {
        played = true;
        break;
      }
    }
    if (!played || game.phase !== PHASE_OVER) {
      // Fallback: the finisher was not in hand; deal the verdict directly.
      loser.life = 0;
      game.winner = name === 'win' ? 'player' : 'rival';
      game.phase = PHASE_OVER;
    }
    return { game, screen: SCREEN_OVER };
  }
  return { game: createGame(seed), screen: SCREEN_TITLE };
}
