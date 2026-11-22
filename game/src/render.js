// The table: builds the DOM once and repaints it from the game state. Cards
// are real DOM, so their values stay crisp when a screenshot shrinks them.
// Screens: 'title' (the title overlay), 'play' (the table), 'over' (the
// win/loss overlay). The renderer never owns rules; it only shows state.

import { CARD_BY_ID, SUITS, describeCard, mainNumber } from './cards.js';
import { START_LIFE } from './state.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

const SUIT_ART = {
  flame:
    '<path d="M12 2c1.5 4.5 8 6.5 8 12.5a8 8 0 1 1-16 0C4 8.5 10.5 6.5 12 2z"/><path d="M12 10c.8 2.4 4 3.4 4 6.5a4 4 0 1 1-8 0c0-3.1 3.2-4.1 4-6.5z" fill="#fff" opacity="0.55"/>',
  tide: '<path d="M12 2S5 11 5 15.5a7 7 0 1 0 14 0C19 11 12 2 12 2z"/>',
  thorn:
    '<path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z"/><path d="M4 20C9 15 13 11 19 5" stroke="#fff" stroke-width="1.6" fill="none" opacity="0.6"/>',
  stone: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7L12 2z"/><path d="M12 7l4.5 2.6v5.2L12 17.4l-4.5-2.6V9.6L12 7z" fill="#fff" opacity="0.45"/>',
};

export function suitIcon(suit, size) {
  const art = SUIT_ART[SUITS[suit].glyph];
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${art}</svg>`;
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function lifeBar(side, label) {
  const pct = Math.max(0, Math.min(100, (side.life / START_LIFE) * 100));
  const wrap = el('div', 'lifebar-wrap');
  wrap.innerHTML =
    `<div class="lifebar-label">${label}</div>` +
    `<div class="lifebar"><div class="lifebar-fill" style="width:${pct}%"></div>` +
    `<span class="lifebar-text">♥ ${side.life} / ${START_LIFE}</span></div>` +
    `<div class="badges">${side.shield ? `<span class="badge shield">🛡 ${side.shield}</span>` : ''}` +
    `${side.poison ? `<span class="badge poison">☠ ${side.poison}</span>` : ''}</div>`;
  return wrap;
}

function manaRow(side) {
  const dots = [];
  for (let i = 0; i < side.maxMana; i += 1) {
    dots.push(`<span class="mana-dot${i < side.mana ? ' on' : ''}">◆</span>`);
  }
  return `<div class="mana-row" title="Mana">${dots.join('')}<span class="mana-text">${side.mana}/${side.maxMana}</span></div>`;
}

export function createRenderer(root, hooks) {
  const table = el('div', 'table');
  table.id = 'table';

  const topbar = el('div', 'topbar');
  topbar.innerHTML =
    '<div class="brand">EMBER PACT</div>' +
    '<div class="topbar-right">' +
    '<span id="turnLabel" class="turn-label"></span>' +
    '<button id="howBtn" class="mini-btn" type="button">How to play</button>' +
    '<button id="soundBtn" class="mini-btn" type="button">♪ Sound on</button>' +
    '<button id="restartBtn" class="mini-btn" type="button">↺ Restart</button>' +
    '</div>';
  table.appendChild(topbar);

  const rivalZone = el('div', 'zone rival-zone');
  rivalZone.innerHTML =
    '<div class="portrait rival-portrait">AW</div>' +
    '<div class="side-info" id="rivalInfo"></div>' +
    '<div class="telegraph" id="telegraph"></div>' +
    '<div class="hand rival-hand" id="rivalHand"></div>';
  table.appendChild(rivalZone);

  const middle = el('div', 'middle');
  middle.innerHTML =
    '<div class="cycle" id="cycle">' +
    '<div class="cycle-title">ADVANTAGE</div>' +
    '<div class="cycle-row"><span class="cyc flame">▲ Flame</span> beats <span class="cyc thorn">❧ Thorn</span></div>' +
    '<div class="cycle-row"><span class="cyc thorn">❧ Thorn</span> beats <span class="cyc tide">💧 Tide</span></div>' +
    '<div class="cycle-row"><span class="cyc tide">💧 Tide</span> beats <span class="cyc flame">▲ Flame</span></div>' +
    '<div class="cycle-row"><span class="cyc stone">⬢ Stone</span> is neutral</div>' +
    '<div class="cycle-note">Same suit twice in a turn: SURGE +2</div>' +
    '</div>' +
    '<div class="played" id="played"></div>' +
    '<div class="log" id="log"></div>';
  table.appendChild(middle);

  const playerZone = el('div', 'zone player-zone');
  playerZone.innerHTML =
    '<div class="portrait player-portrait">YOU</div>' +
    '<div class="side-info" id="playerInfo"></div>' +
    '<div class="hand player-hand" id="playerHand"></div>' +
    '<button id="endTurnBtn" class="end-turn" type="button">END TURN ⏎</button>';
  table.appendChild(playerZone);

  const overlay = el('div', 'overlay hidden');
  overlay.id = 'overlay';
  table.appendChild(overlay);

  const floatLayer = el('div', 'float-layer');
  table.appendChild(floatLayer);

  root.appendChild(table);

  const turnLabel = table.querySelector('#turnLabel');
  const rivalInfo = table.querySelector('#rivalInfo');
  const playerInfo = table.querySelector('#playerInfo');
  const rivalHand = table.querySelector('#rivalHand');
  const playerHand = table.querySelector('#playerHand');
  const played = table.querySelector('#played');
  const logBox = table.querySelector('#log');
  const endTurnBtn = table.querySelector('#endTurnBtn');

  table.querySelector('#howBtn').addEventListener('click', () => hooks.onHowTo());
  table.querySelector('#restartBtn').addEventListener('click', () => hooks.onRestart());
  const soundBtn = table.querySelector('#soundBtn');
  soundBtn.addEventListener('click', () => {
    const on = hooks.onToggleSound();
    soundBtn.textContent = on ? '♪ Sound on' : '♪ Sound off';
  });
  endTurnBtn.addEventListener('click', () => hooks.onEndTurn());

  function cardFace(card, opts) {
    const node = el('div', `card suit-${card.suit}${opts.playable ? ' playable' : ''}${opts.small ? ' small' : ''}`);
    node.innerHTML =
      `<div class="cost">${card.cost}</div>` +
      `<div class="card-art">${suitIcon(card.suit, opts.small ? 34 : 44)}</div>` +
      `<div class="card-name">${card.name}</div>` +
      `<div class="card-power">${mainNumber(card)}</div>` +
      `<div class="card-text">${describeCard(card)}</div>` +
      `<div class="card-suit">${SUITS[card.suit].label}</div>`;
    if (opts.onClick) node.addEventListener('click', opts.onClick);
    return node;
  }

  function cardBack() {
    const node = el('div', 'card back');
    node.innerHTML = '<div class="back-emblem">✦</div>';
    return node;
  }

  function renderHand(handEl, side, faceDown, screen) {
    handEl.replaceChildren();
    if (faceDown) {
      for (let i = 0; i < side.hand.length; i += 1) handEl.appendChild(cardBack());
      return;
    }
    side.hand.forEach((cardId) => {
      const card = CARD_BY_ID[cardId];
      const playable = screen === SCREEN_PLAY && side.mana >= card.cost;
      handEl.appendChild(
        cardFace(card, {
          playable,
          onClick: playable ? () => hooks.onPlayCard(cardId) : null,
        }),
      );
    });
  }

  function renderPlayed(game) {
    played.replaceChildren();
    if (!game.lastPlay) {
      played.appendChild(el('div', 'played-empty', 'No card played yet — play one from your hand.'));
      return;
    }
    const play = game.lastPlay;
    const node = cardFace(play.card, { small: true });
    const tag = el('div', 'played-tag');
    tag.textContent =
      (play.by === 'player' ? 'You played' : 'Rival played') +
      (play.surge ? ' · SURGE +2' : '') +
      (play.advantage ? ' · ADVANTAGE +2' : '');
    played.appendChild(tag);
    played.appendChild(node);
  }

  function draw(game, screen, best) {
    table.classList.toggle('is-title', screen === SCREEN_TITLE);
    turnLabel.textContent =
      screen === SCREEN_PLAY
        ? game.phase === 'player'
          ? `TURN ${game.turn} — YOUR MOVE`
          : `TURN ${game.turn} — RIVAL IS THINKING…`
        : screen === SCREEN_TITLE
          ? 'A DUEL OF FOUR ELEMENTS'
          : game.winner === 'player'
            ? 'VICTORY'
            : game.winner === 'rival'
              ? 'DEFEAT'
              : 'DRAW';
    endTurnBtn.disabled = !(screen === SCREEN_PLAY && game.phase === 'player');

    rivalInfo.replaceChildren();
    rivalInfo.appendChild(lifeBar(game.rival, 'ASHEN WARDEN — RIVAL'));
    rivalInfo.insertAdjacentHTML('beforeend', manaRow(game.rival));
    rivalInfo.insertAdjacentHTML(
      'beforeend',
      `<div class="deck-count">Deck ${game.rival.piles.deck.length} · Discard ${game.rival.piles.discard.length}</div>`,
    );

    playerInfo.replaceChildren();
    playerInfo.appendChild(lifeBar(game.player, 'YOU'));
    playerInfo.insertAdjacentHTML('beforeend', manaRow(game.player));
    playerInfo.insertAdjacentHTML(
      'beforeend',
      `<div class="deck-count">Deck ${game.player.piles.deck.length} · Discard ${game.player.piles.discard.length}</div>`,
    );

    renderHand(rivalHand, game.rival, true, screen);
    renderHand(playerHand, game.player, false, screen);
    renderPlayed(game);

    logBox.replaceChildren();
    for (const line of game.log) logBox.appendChild(el('div', 'log-line', line));

    if (screen === SCREEN_TITLE) showTitleOverlay(best);
    else if (screen === SCREEN_OVER) showEndOverlay(game);
    else overlay.classList.add('hidden');
  }

  function showTitleOverlay(best) {
    overlay.classList.remove('hidden');
    overlay.innerHTML =
      '<div class="panel title-panel">' +
      '<div class="title-kicker">A DUEL OF FOUR ELEMENTS</div>' +
      '<h1 class="title-big">EMBER<br>PACT</h1>' +
      '<p class="title-sub">Outwit the Ashen Warden. Spend mana, chain suits, ' +
      'and burn the rival ember to zero before yours fades.</p>' +
      '<div class="suit-grid">' +
      Object.entries(SUITS)
        .map(
          ([key, suit]) =>
            `<div class="suit-chip suit-${key}">${suitIcon(key, 26)}<b>${suit.label}</b><span>${key === 'flame' ? 'Raw damage' : key === 'tide' ? 'Damage + draw' : key === 'thorn' ? 'Poison + heal' : 'Shield + damage'}</span></div>`,
        )
        .join('') +
      '</div>' +
      '<p class="title-rules">Same suit twice in a turn: <b>SURGE +2</b> &nbsp;·&nbsp; ' +
      'Flame beats Thorn beats Tide beats Flame: <b>ADVANTAGE +2</b> &nbsp;·&nbsp; ' +
      'Keys <b>1–7</b> play a card, <b>Enter</b> ends your turn.</p>' +
      `<p class="title-best">${best.wins} wins · ${best.losses} losses on this table</p>` +
      '<button id="startBtn" class="big-btn" type="button">START THE DUEL</button>' +
      '<button id="howBtn2" class="ghost-btn" type="button">How to play</button>' +
      '</div>';
    overlay.querySelector('#startBtn').addEventListener('click', () => hooks.onStart());
    overlay.querySelector('#howBtn2').addEventListener('click', () => hooks.onHowTo());
  }

  function showEndOverlay(game) {
    const win = game.winner === 'player';
    const drawGame = game.winner === 'draw';
    overlay.classList.remove('hidden');
    overlay.innerHTML =
      '<div class="panel end-panel">' +
      `<h1 class="end-title ${win ? 'win' : drawGame ? 'draw' : 'lose'}">${win ? 'VICTORY' : drawGame ? 'DRAW' : 'DEFEAT'}</h1>` +
      `<p class="end-sub">${win ? 'The Ashen Warden bows. Your ember burns brightest.' : drawGame ? 'Both embers burn low together — no victor tonight.' : 'The Ashen Warden takes the table. Demand a rematch.'}</p>` +
      `<div class="end-stats"><span>${game.turn} turns</span><span>${game.player.damageDealt} damage dealt</span><span>${game.player.cardsPlayed} cards played</span></div>` +
      '<button id="againBtn" class="big-btn" type="button">PLAY AGAIN</button>' +
      '</div>';
    overlay.querySelector('#againBtn').addEventListener('click', () => hooks.onStart());
  }

  function setTelegraph(cardId) {
    const box = table.querySelector('#telegraph');
    box.replaceChildren();
    if (!cardId) {
      box.appendChild(el('div', 'telegraph-empty', 'Rival is thinking…'));
      return;
    }
    const card = CARD_BY_ID[cardId];
    const tag = el('div', 'telegraph-tag', 'RIVAL PLANS NEXT:');
    const node = cardFace(card, { small: true });
    node.classList.add('telegraphed');
    box.appendChild(tag);
    box.appendChild(node);
  }

  function floatText(text, target, kind) {
    const rect = table.getBoundingClientRect();
    const at = target.getBoundingClientRect();
    const node = el('div', `float-text ${kind}`, text);
    node.style.left = `${at.left - rect.left + at.width / 2}px`;
    node.style.top = `${at.top - rect.top}px`;
    floatLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 1400);
  }

  function shake() {
    table.classList.remove('shake');
    void table.offsetWidth;
    table.classList.add('shake');
  }

  function confetti() {
    for (let i = 0; i < 48; i += 1) {
      const piece = el('div', 'confetti');
      piece.style.left = `${4 + Math.random() * 92}%`;
      piece.style.background = ['#e2483d', '#2f8fd0', '#4da24a', '#d9a441', '#f5e6c8'][i % 5];
      piece.style.animationDelay = `${Math.random() * 0.7}s`;
      floatLayer.appendChild(piece);
      window.setTimeout(() => piece.remove(), 2600);
    }
  }

  return { draw, setTelegraph, floatText, shake, confetti, table };
}
