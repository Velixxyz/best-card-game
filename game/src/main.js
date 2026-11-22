// Boot and the turn loop for Ember Pact. The player acts on their turn; the
// rival's turn is played out card by card with a telegraph of its opening
// card, so the player can read the plan coming. Keyboard: 1-7 plays a hand
// card, Enter ends the turn.
//
// ?seed=N fixes the shuffle. ?shot=title|table|win|loss (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { createGame, startDuel, playCard, endTurn, PHASE_OVER } from './state.js';
import { chooseNextCard, chooseOpening } from './ai.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'ember-pact-best';
const AI_CARD_DELAY_MS = 850;
const TELEGRAPH_MS = 1100;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const root = document.getElementById('app');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(root, {
  onStart: () => startGame(),
  onRestart: () => startGame(),
  onPlayCard: (cardId) => playerPlays(cardId),
  onEndTurn: () => playerEndsTurn(),
  onToggleSound: () => audio.toggle(),
  onHowTo: () => showHowTo(),
});

let game = createGame(seed);
let screen = SCREEN_TITLE;
let aiTimer = null;

function readBest() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(BEST_KEY) ?? '{"wins":0,"losses":0}');
    return { wins: raw.wins | 0, losses: raw.losses | 0 };
  } catch {
    return { wins: 0, losses: 0 };
  }
}

function saveBest(best) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Storage can be off (private windows): the record then lasts this visit only.
  }
}

function announce(message) {
  status.textContent = message;
}

function render() {
  renderer.draw(game, screen, readBest());
}

function startGame() {
  window.clearTimeout(aiTimer);
  game = createGame(Math.floor(Math.random() * 4294967296));
  screen = SCREEN_PLAY;
  startDuel(game);
  announce('Your move. Play a card, then end your turn.');
  render();
}

function finishGame() {
  screen = SCREEN_OVER;
  const best = readBest();
  if (game.winner === 'player') {
    best.wins += 1;
    audio.win();
    renderer.confetti();
  } else if (game.winner === 'rival') {
    best.losses += 1;
    audio.lose();
  }
  saveBest(best);
  announce(
    game.winner === 'player'
      ? 'Victory! The Ashen Warden bows.'
      : game.winner === 'rival'
        ? 'Defeat. The Ashen Warden takes the table.'
        : 'A draw — both embers burn low together.',
  );
  render();
}

function playerPlays(cardId) {
  if (screen !== SCREEN_PLAY || game.phase !== 'player') return;
  const played = playCard(game, game.player, cardId);
  if (!played) return;
  audio.play();
  if (played.damage) {
    audio.hit();
    renderer.shake();
  }
  if (played.heal) audio.heal();
  render();
  if (game.phase === PHASE_OVER) finishGame();
}

function playerEndsTurn() {
  if (screen !== SCREEN_PLAY || game.phase !== 'player') return;
  endTurn(game);
  render();
  if (game.phase === PHASE_OVER) {
    finishGame();
    return;
  }
  runRivalTurn();
}

function runRivalTurn() {
  // Telegraph the rival's opening card first: the player sees the plan.
  const opening = chooseOpening(game);
  renderer.setTelegraph(opening);
  announce(opening ? `Rival plans to play ${opening}.` : 'Rival is thinking…');
  window.setTimeout(() => {
    renderer.setTelegraph(null);
    stepRival();
  }, TELEGRAPH_MS);
}

function stepRival() {
  if (screen !== SCREEN_PLAY || game.phase !== 'ai') return;
  const cardId = chooseNextCard(game, game.rival);
  if (!cardId) {
    endTurn(game);
    render();
    if (game.phase === PHASE_OVER) finishGame();
    return;
  }
  const played = playCard(game, game.rival, cardId);
  if (played) {
    audio.play();
    if (played.damage) {
      audio.hit();
      renderer.shake();
    }
    if (played.heal) audio.heal();
  }
  render();
  if (game.phase === PHASE_OVER) {
    finishGame();
    return;
  }
  aiTimer = window.setTimeout(stepRival, AI_CARD_DELAY_MS);
}

function showHowTo() {
  announce(
    'How to play: each turn you gain mana and draw a card. Play cards to damage the rival, shield yourself, heal, or poison. Same suit twice: Surge +2. Flame beats Thorn beats Tide beats Flame: Advantage +2. Reduce the rival ember to zero to win.',
  );
  window.alert(
    'EMBER PACT — how to play\n\n' +
      'Each turn you gain mana (up to 10) and draw a card. Click a card to play it, then END TURN.\n\n' +
      '• Flame: raw damage · Tide: damage + draw · Thorn: poison + heal · Stone: shield + damage\n' +
      '• SURGE: play two cards of the same suit in one turn — the second gets +2.\n' +
      '• ADVANTAGE: Flame beats Thorn, Thorn beats Tide, Tide beats Flame — +2 damage. Stone is neutral.\n' +
      '• Poison ticks at the start of a turn. Shield fades at the start of your next turn.\n' +
      '• Reduce the rival ember to zero to win. Keys 1–7 play a card, Enter ends your turn.',
  );
}

document.addEventListener('keydown', (event) => {
  if (shot) return;
  if (screen === SCREEN_TITLE && (event.key === 'Enter' || event.key === ' ')) {
    startGame();
    return;
  }
  if (screen === SCREEN_OVER && (event.key === 'Enter' || event.key === ' ')) {
    startGame();
    return;
  }
  if (screen !== SCREEN_PLAY || game.phase !== 'player') return;
  if (event.key === 'Enter') {
    playerEndsTurn();
    return;
  }
  const index = Number.parseInt(event.key, 10) - 1;
  if (index >= 0 && index < game.player.hand.length) {
    playerPlays(game.player.hand[index]);
  }
});

// Leaving the tab mid-duel just leaves the table as it is: a turn-based game
// waits for the player, so nothing needs pausing.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

if (shot) {
  const staged = stageShot(shot, seed);
  game = staged.game;
  screen = staged.screen;
  let painted = 0;
  const paint = () => {
    render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  announce('Ember Pact. Press Enter or click Start the Duel.');
  render();
}
