// The card catalogue for Ember Pact: every card the game can deal, and the
// four suits with their colours, shapes and the advantage cycle between them.
// A card is plain data: { id, name, suit, cost, damage, shield, heal,
// poison, draw, self }. Numbers are the card's base effect before Surge and
// Advantage bonuses are applied by state.js.

export const SUITS = {
  flame: { label: 'Flame', color: '#e2483d', dark: '#8f1d16', glyph: 'flame' },
  tide: { label: 'Tide', color: '#2f8fd0', dark: '#14486e', glyph: 'tide' },
  thorn: { label: 'Thorn', color: '#4da24a', dark: '#1f5c22', glyph: 'thorn' },
  stone: { label: 'Stone', color: '#d9a441', dark: '#7a5514', glyph: 'stone' },
};

// Flame beats Thorn, Thorn beats Tide, Tide beats Flame. Stone is neutral:
// it never gains or grants an advantage.
export const BEATS = { flame: 'thorn', thorn: 'tide', tide: 'flame', stone: null };

export function suitBeats(attackerSuit, defenderSuit) {
  return BEATS[attackerSuit] === defenderSuit;
}

export const CARD_LIST = [
  // Flame: raw damage, the suit that ends games.
  { id: 'spark', name: 'Spark Dart', suit: 'flame', cost: 1, damage: 3 },
  { id: 'ember', name: 'Ember Slash', suit: 'flame', cost: 2, damage: 4 },
  { id: 'pyre', name: 'Pyre Burst', suit: 'flame', cost: 3, damage: 7 },
  { id: 'inferno', name: 'Inferno Pact', suit: 'flame', cost: 5, damage: 10, self: 2 },
  // Tide: damage plus card draw, the suit that keeps a hand full.
  { id: 'ripple', name: 'Ripple Cut', suit: 'tide', cost: 1, damage: 2, draw: 1 },
  { id: 'undertow', name: 'Undertow', suit: 'tide', cost: 2, damage: 3, draw: 1 },
  { id: 'current', name: 'Deep Current', suit: 'tide', cost: 3, damage: 3, draw: 2 },
  // Thorn: poison that ticks at the start of a turn, plus the game's heal.
  { id: 'bramble', name: 'Bramble Prick', suit: 'thorn', cost: 1, damage: 2, poison: 2 },
  { id: 'vine', name: 'Vine Snare', suit: 'thorn', cost: 2, damage: 3, poison: 3 },
  { id: 'bloom', name: 'Bloom Mend', suit: 'thorn', cost: 2, heal: 6 },
  { id: 'embrace', name: 'Thorn Embrace', suit: 'thorn', cost: 4, damage: 4, poison: 4 },
  // Stone: shields that absorb damage, plus a little damage of its own.
  { id: 'pebble', name: 'Pebble Guard', suit: 'stone', cost: 1, shield: 4 },
  { id: 'granite', name: 'Granite Wall', suit: 'stone', cost: 2, shield: 7 },
  { id: 'quake', name: 'Quake Slam', suit: 'stone', cost: 3, damage: 5, shield: 3 },
  { id: 'mountain', name: 'Mountain Oath', suit: 'stone', cost: 4, damage: 2, shield: 10 },
];

export const CARD_BY_ID = Object.fromEntries(CARD_LIST.map((card) => [card.id, card]));

// One short line for the card face, built from its numbers. Kept terse on
// purpose: the face has one line of room before the suit label below it.
export function describeCard(card) {
  const parts = [];
  if (card.damage) parts.push(`Deal ${card.damage}`);
  if (card.shield) parts.push(`Shield ${card.shield}`);
  if (card.heal) parts.push(`Heal ${card.heal}`);
  if (card.poison) parts.push(`Poison ${card.poison}`);
  if (card.draw) parts.push(`Draw ${card.draw}`);
  if (card.self) parts.push(`Lose ${card.self}`);
  return parts.join(' · ');
}

// The big number on the card face: its main effect, for a glanceable read.
export function mainNumber(card) {
  if (card.damage) return card.damage;
  if (card.shield) return card.shield;
  if (card.heal) return card.heal;
  return card.poison ?? 0;
}
