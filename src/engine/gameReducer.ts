import {
  GameState, GameAction, PlayerState, Card, Meld,
  Rules, AIDifficulty, DEFAULT_RULES, RoundResult,
} from './types';
import { createShuffledDeck, isWild, isRed3, isBlack3, cardPointValue, cardLabel } from './deck';
import {
  canFormMeld, meldRank, newMeldId, meldPointValue,
  canAddToMeld, initialMeldMinimum, canGoOut, isCanasta,
} from './meld';
import { scoreRound } from './scoring';

function makePlayer(totalScore = 0): PlayerState {
  return { hand: [], melds: [], redThrees: [], totalScore, hasOpenedMeld: false };
}

function processRed3s(
  hand: Card[],
  stock: Card[],
  redThrees: Card[],
  log: string[],
  playerName: string,
): { hand: Card[]; stock: Card[]; redThrees: Card[] } {
  let h = [...hand];
  let s = [...stock];
  let r3 = [...redThrees];
  let found = true;
  while (found) {
    found = false;
    const idx = h.findIndex(c => isRed3(c));
    if (idx !== -1) {
      found = true;
      const card = h.splice(idx, 1)[0];
      r3.push(card);
      log.push(`${playerName} places Red 3 (${cardLabel(card)}).`);
      if (s.length > 0) h.push(s.shift()!);
    }
  }
  return { hand: h, stock: s, redThrees: r3 };
}

export function initialState(): GameState {
  return {
    phase: 'menu',
    rules: DEFAULT_RULES,
    stock: [],
    discardPile: [],
    players: [makePlayer(), makePlayer()],
    currentPlayer: 0,
    turnPhase: 'draw',
    isDiscardFrozen: false,
    selectedCards: [],
    log: [],
    roundResults: [],
    roundNum: 0,
    aiDifficulty: 'medium',
    winner: null,
    aiThinking: false,
    message: '',
    lastDrawnCards: [],
    openingTurnMeldPoints: 0,
    pileTopCardId: null,
    pendingPileCards: [],
    undoSnapshot: null,
  };
}

function startRound(state: GameState): GameState {
  const deck = createShuffledDeck(state.rules.threeDecks ? 3 : 2);
  const log: string[] = [`--- Round ${state.roundNum + 1} ---`];

  let hand0 = deck.splice(0, 15);
  let hand1 = deck.splice(0, 15);
  let stock = [...deck];

  let r0 = processRed3s(hand0, stock, [], log, 'You');
  hand0 = r0.hand; stock = r0.stock;

  let r1 = processRed3s(hand1, stock, [], log, 'Computer');
  hand1 = r1.hand; stock = r1.stock;

  // Set up discard pile — draw until non-wild, non-red3
  let discardPile: Card[] = [];
  let isFrozen = false;
  while (stock.length > 0) {
    const top = stock.shift()!;
    if (isRed3(top)) continue; // skip red 3s
    discardPile = [top];
    if (isWild(top)) {
      isFrozen = true;
      log.push('Discard pile starts with wild card — pile is frozen.');
    } else if (isBlack3(top)) {
      log.push('Discard pile starts with Black 3 — pile is blocked.');
    }
    break;
  }

  const p0: PlayerState = {
    ...makePlayer(state.players[0].totalScore),
    hand: hand0,
    redThrees: r0.redThrees,
  };
  const p1: PlayerState = {
    ...makePlayer(state.players[1].totalScore),
    hand: hand1,
    redThrees: r1.redThrees,
  };

  return {
    ...state,
    phase: 'playing',
    stock,
    discardPile,
    players: [p0, p1],
    currentPlayer: 0,
    turnPhase: 'draw',
    isDiscardFrozen: isFrozen || state.rules.frozenPile,
    selectedCards: [],
    log,
    roundNum: state.roundNum + 1,
    aiThinking: false,
    winner: null,
    message: 'Your turn — draw from stock or pick up the discard pile.',
    openingTurnMeldPoints: 0,
    pileTopCardId: null,
    pendingPileCards: [],
    lastDrawnCards: [],
    undoSnapshot: null,
  };
}

function canPickupPile(
  player: PlayerState,
  discardPile: Card[],
  isFrozen: boolean,
  rules: { frozenPile: boolean },
): boolean {
  if (discardPile.length === 0) return false;
  const top = discardPile[discardPile.length - 1];
  if (isBlack3(top) || isWild(top)) return false;

  const matching = player.hand.filter(c => c.rank === top.rank && !isWild(c));
  const effectivelyFrozen = isFrozen || rules.frozenPile;

  // Frozen pile: always need 2 naturals matching top card
  if (effectivelyFrozen) return matching.length >= 2;

  // Unfrozen — need to be able to play the top card:
  // Either extend an existing meld (1 natural) or start a new one (2 naturals)
  if (!player.hasOpenedMeld) {
    // Haven't opened yet: need 2 naturals to form opening meld with top card
    return matching.length >= 2;
  }
  // Can add top card to existing meld (no hand card needed) — but not if it's already a canasta
  if (player.melds.some(m => m.rank === top.rank && !isCanasta(m))) return true;
  // Or form new meld: need 2 naturals in hand + top card = 3
  return matching.length >= 2;
}

function endTurn(state: GameState, goingOut: boolean, concealed: boolean): GameState {
  const current = state.currentPlayer;
  const player = state.players[current];

  if (goingOut) {
    return resolveRound(state, current, concealed);
  }

  // Check if stock is empty → round ends
  if (state.stock.length === 0 && !goingOut) {
    return resolveRound(state, null, false);
  }

  const next = current === 0 ? 1 : 0;
  const isAI = next === 1;
  return {
    ...state,
    currentPlayer: next as 0 | 1,
    turnPhase: 'draw',
    selectedCards: [],
    lastDrawnCards: [],
    openingTurnMeldPoints: 0,
    pileTopCardId: null,
    pendingPileCards: [],
    aiThinking: isAI,
    message: isAI ? 'Computer is thinking…' : 'Your turn — draw or pick up pile.',
    undoSnapshot: null,
  };
}

function resolveRound(state: GameState, goingOutPlayer: 0 | 1 | null, concealed: boolean): GameState {
  const allR3 = (p: PlayerState) => p.redThrees.length === 4;

  const s0 = scoreRound(state.players[0], goingOutPlayer === 0, concealed && goingOutPlayer === 0, state.rules);
  const s1 = scoreRound(state.players[1], goingOutPlayer === 1, concealed && goingOutPlayer === 1, state.rules);

  const newTotal0 = state.players[0].totalScore + s0.total;
  const newTotal1 = state.players[1].totalScore + s1.total;

  const result: RoundResult = {
    roundNum: state.roundNum,
    scores: [s0.total, s1.total],
    runningTotals: [newTotal0, newTotal1],
    goingOutPlayer,
    concealed,
    stockEmpty: state.stock.length === 0,
  };

  const target = state.rules.targetScore;
  const gameOver = newTotal0 >= target || newTotal1 >= target;

  let winner: 0 | 1 | null = null;
  if (gameOver) {
    winner = newTotal0 >= newTotal1 ? 0 : 1;
  }

  const log = [...state.log];
  if (goingOutPlayer !== null) {
    log.push(`${goingOutPlayer === 0 ? 'You' : 'Computer'} went out${concealed ? ' (concealed)' : ''}!`);
  } else {
    log.push('Stock empty — round ends.');
  }
  log.push(`Round scores: You ${s0.total > 0 ? '+' : ''}${s0.total}, Computer ${s1.total > 0 ? '+' : ''}${s1.total}`);

  return {
    ...state,
    phase: gameOver ? 'gameEnd' : 'roundEnd',
    players: [
      { ...state.players[0], totalScore: newTotal0 },
      { ...state.players[1], totalScore: newTotal1 },
    ],
    roundResults: [...state.roundResults, result],
    winner,
    log,
    aiThinking: false,
    message: gameOver
      ? `Game over! ${winner === 0 ? 'You win!' : 'Computer wins!'}`
      : 'Round over.',
  };
}

function drawFromStock(state: GameState): GameState {
  if (state.turnPhase !== 'draw') return { ...state, message: 'Not your draw phase.' };
  if (state.stock.length === 0) {
    return resolveRound(state, null, false);
  }

  const stock = [...state.stock];
  let hand = [...state.players[state.currentPlayer].hand];
  let redThrees = [...state.players[state.currentPlayer].redThrees];
  const log = [...state.log];
  const drawCount = state.rules.drawTwo ? 2 : 1;

  const newCardIds: string[] = [];
  const who = state.currentPlayer === 0 ? 'You' : 'Computer';

  const isComputer = state.currentPlayer === 1;
  let normalDrawCount = 0;
  let red3DrawCount = 0;

  for (let i = 0; i < drawCount && stock.length > 0; i++) {
    const card = stock.shift()!;
    if (isRed3(card)) {
      redThrees.push(card);
      red3DrawCount++;
      if (!isComputer) log.push(`${who} drew Red 3 (${cardLabel(card)}) — placed automatically.`);
      // Keep drawing replacements until a non-red-3 is found or stock runs out
      while (stock.length > 0) {
        const replacement = stock.shift()!;
        if (isRed3(replacement)) {
          redThrees.push(replacement);
          red3DrawCount++;
          if (!isComputer) log.push(`Replacement also Red 3 (${cardLabel(replacement)}) — placed.`);
        } else {
          hand.push(replacement);
          newCardIds.push(replacement.id);
          normalDrawCount++;
          if (!isComputer) log.push(`${who} drew ${cardLabel(replacement)}.`);
          break;
        }
      }
    } else {
      hand.push(card);
      newCardIds.push(card.id);
      normalDrawCount++;
      if (!isComputer) log.push(`${who} drew ${cardLabel(card)}.`);
    }
  }
  if (isComputer) {
    const parts: string[] = [];
    if (normalDrawCount > 0) parts.push(`${normalDrawCount} card${normalDrawCount > 1 ? 's' : ''}`);
    if (red3DrawCount > 0) parts.push(`${red3DrawCount} Red 3${red3DrawCount > 1 ? 's' : ''}`);
    log.push(`Computer drew ${parts.join(' and ')}.`);
  }

  const players: [PlayerState, PlayerState] = [...state.players] as [PlayerState, PlayerState];
  players[state.currentPlayer] = { ...players[state.currentPlayer], hand, redThrees };

  const isPlayer = state.currentPlayer === 0;
  return {
    ...state,
    stock,
    players,
    turnPhase: 'play',
    lastDrawnCards: newCardIds,
    log,
    message: 'Meld cards or discard to end your turn.',
    undoSnapshot: isPlayer ? (({ undoSnapshot: _u, ...snap }) => snap)(state) : null,
  };
}

function pickupDiscardPile(state: GameState): GameState {
  if (state.turnPhase !== 'draw') return { ...state, message: 'Not your draw phase.' };
  const player = state.players[state.currentPlayer];
  if (!canPickupPile(player, state.discardPile, state.isDiscardFrozen, state.rules)) {
    return { ...state, message: 'Cannot pick up the discard pile.' };
  }

  const pile = [...state.discardPile];
  const topCard = pile[pile.length - 1];
  const restOfPile = pile.slice(0, -1);

  // Only top card goes to hand now; rest waits until top card is melded
  const hand = [...player.hand, topCard];
  const players: [PlayerState, PlayerState] = [...state.players] as [PlayerState, PlayerState];
  players[state.currentPlayer] = { ...player, hand };

  const who = state.currentPlayer === 0 ? 'You' : 'Computer';
  const isComp = state.currentPlayer === 1;
  const pileMsg = isComp
    ? `Computer picks up the discard pile (${pile.length} cards).`
    : `You pick up pile (${pile.length} cards). Meld ${cardLabel(topCard)} first.`;
  const log = [...state.log, pileMsg];

  return {
    ...state,
    players,
    discardPile: [],
    isDiscardFrozen: false,
    turnPhase: 'play',
    pileTopCardId: topCard.id,
    pendingPileCards: restOfPile,
    lastDrawnCards: [topCard.id],
    log,
    message: `Meld ${cardLabel(topCard)} (highlighted) to receive the rest of the pile.`,
    undoSnapshot: isComp ? null : (({ undoSnapshot: _u, ...snap }) => snap)(state),
  };
}

function createMeld(state: GameState): GameState {
  if (state.turnPhase !== 'play') return { ...state, message: 'Draw first.' };
  const player = state.players[state.currentPlayer];
  const cards = player.hand.filter(c => state.selectedCards.includes(c.id));

  const handAfterMeld = player.hand.filter(c => !state.selectedCards.includes(c.id));
  const hasBlack3s = cards.some(c => isBlack3(c));
  // Going-out turn: hand empty after meld, OR exactly one black 3 remains (to be discarded)
  const goingOutAfter = handAfterMeld.length === 0
    || (handAfterMeld.length === 1 && isBlack3(handAfterMeld[0]));

  // Black 3s only allowed on going-out turn
  if (!canFormMeld(cards, state.rules, goingOutAfter)) {
    if (hasBlack3s && !goingOutAfter) {
      return { ...state, message: 'Black 3s can only be melded when going out.' };
    }
    return { ...state, message: 'Invalid meld — check card count and wild card rules.' };
  }

  // If pile top card must be melded, enforce it's included
  if (state.pileTopCardId && !state.selectedCards.includes(state.pileTopCardId)) {
    return { ...state, message: `Must meld the pile's top card first.` };
  }

  const rank = meldRank(cards);
  const openingValue = cards.filter(c => !isBlack3(c)).reduce((s, c) => s + cardPointValue(c), 0);
  const newOpeningPoints = state.openingTurnMeldPoints + openingValue;
  const min = initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);

  const includingPileTop = !!(state.pileTopCardId && state.selectedCards.includes(state.pileTopCardId));
  const pileMinMet = player.hasOpenedMeld || newOpeningPoints >= min;

  // Pile top must be in first meld, but can accumulate pts across melds before pile releases
  const newMeld: Meld = { id: newMeldId(), rank, cards };
  let hand = [...handAfterMeld];

  // Release pile if: top card just melded AND minimum met, OR top was already melded and minimum now met
  const topJustMelded = includingPileTop;
  const pileAlreadyTopMelded = !state.pileTopCardId && state.pendingPileCards.length > 0;
  const resolvedPile = (topJustMelded || pileAlreadyTopMelded) && pileMinMet;
  if (resolvedPile && state.pendingPileCards.length > 0) {
    hand = [...hand, ...state.pendingPileCards];
  }

  const melds = [...player.melds, newMeld];
  const nowOpened = !player.hasOpenedMeld &&
    newOpeningPoints >= initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);

  const players: [PlayerState, PlayerState] = [...state.players] as [PlayerState, PlayerState];
  players[state.currentPlayer] = {
    ...player, hand, melds,
    hasOpenedMeld: player.hasOpenedMeld || nowOpened,
  };

  const who = state.currentPlayer === 0 ? 'You' : 'Computer';
  const cardNames = cards.map(c => cardLabel(c)).join(' ');
  const log = [...state.log, `${who} melded ${rank}×${cards.length}: ${cardNames}.`];
  if (resolvedPile && state.pendingPileCards.length > 0) {
    log.push(`${who} receives ${state.pendingPileCards.length} remaining pile cards.`);
  }

  const goingOut = hand.length === 0 && canGoOut(players[state.currentPlayer], state.rules);
  const isConcealed = !player.hasOpenedMeld && hand.length === 0;

  // Block meld that would empty hand when player can't actually go out
  if (hand.length === 0 && !goingOut) {
    return { ...state, message: 'Can\'t go out yet — need more canastas first.' };
  }

  const newState: GameState = {
    ...state,
    players,
    selectedCards: [],
    openingTurnMeldPoints: newOpeningPoints,
    pileTopCardId: includingPileTop ? null : state.pileTopCardId,
    pendingPileCards: resolvedPile ? [] : state.pendingPileCards,
    lastDrawnCards: resolvedPile ? state.pendingPileCards.map(c => c.id) : state.lastDrawnCards,
    log,
    message: goingOut ? 'Going out!'
      : (state.pendingPileCards.length > 0 && !resolvedPile)
        ? `Meld ${min - newOpeningPoints} more pts to receive the pile (${newOpeningPoints}/${min}).`
        : hand.length === 0 ? 'Discard to go out.' : 'Meld more or discard.',
  };

  if (goingOut) return endTurn(newState, true, isConcealed);
  return newState;
}

function addToMeld(state: GameState, meldId: string): GameState {
  if (state.turnPhase !== 'play') return { ...state, message: 'Draw first.' };
  const player = state.players[state.currentPlayer];
  const meld = player.melds.find(m => m.id === meldId);
  if (!meld) return { ...state, message: 'Meld not found.' };

  const cards = player.hand.filter(c => state.selectedCards.includes(c.id));
  if (cards.length === 0) return { ...state, message: 'Select cards first.' };

  for (const card of cards) {
    if (!canAddToMeld(meld, card, state.rules)) {
      return { ...state, message: `Cannot add ${card.rank} to ${meld.rank} meld.` };
    }
  }

  // If pile top card must be melded, enforce it's included
  if (state.pileTopCardId && !state.selectedCards.includes(state.pileTopCardId)) {
    return { ...state, message: `Must meld the pile's top card first.` };
  }

  const includingPileTop = !!(state.pileTopCardId && state.selectedCards.includes(state.pileTopCardId));
  const value = cards.filter(c => !isBlack3(c)).reduce((s, c) => s + cardPointValue(c), 0);
  const newOpeningPoints = state.openingTurnMeldPoints + value;
  const min = initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);
  const pileMinMet = player.hasOpenedMeld || newOpeningPoints >= min;
  const pileAlreadyTopMelded = !state.pileTopCardId && state.pendingPileCards.length > 0;
  const resolvedPile = (includingPileTop || pileAlreadyTopMelded) && pileMinMet;

  const updatedMeld: Meld = { ...meld, cards: [...meld.cards, ...cards] };
  let hand = player.hand.filter(c => !state.selectedCards.includes(c.id));

  if (resolvedPile && state.pendingPileCards.length > 0) {
    hand = [...hand, ...state.pendingPileCards];
  }

  const melds = player.melds.map(m => m.id === meldId ? updatedMeld : m);
  const nowOpened = !player.hasOpenedMeld && newOpeningPoints >= min;

  const players: [PlayerState, PlayerState] = [...state.players] as [PlayerState, PlayerState];
  players[state.currentPlayer] = { ...player, hand, melds, hasOpenedMeld: player.hasOpenedMeld || nowOpened };

  const who = state.currentPlayer === 0 ? 'You' : 'Computer';
  const cardNames = cards.map(c => cardLabel(c)).join(' ');
  const log = [...state.log, `${who} added to ${meld.rank}: ${cardNames}.`];
  if (resolvedPile && state.pendingPileCards.length > 0) {
    log.push(`${who} receives ${state.pendingPileCards.length} remaining pile cards.`);
  }

  const goingOut = hand.length === 0 && canGoOut(players[state.currentPlayer], state.rules);
  // Block add that would empty hand when player can't actually go out
  if (hand.length === 0 && !goingOut) {
    return { ...state, message: 'Can\'t go out yet — need more canastas first.' };
  }
  if (goingOut) return endTurn({ ...state, players, selectedCards: [], log }, true, false);

  const pendingMsg = state.pendingPileCards.length > 0 && !resolvedPile
    ? `Meld ${min - newOpeningPoints} more pts to receive the pile (${newOpeningPoints}/${min}).`
    : 'Meld more or discard.';

  return {
    ...state, players, selectedCards: [], log,
    openingTurnMeldPoints: newOpeningPoints,
    pileTopCardId: includingPileTop ? null : state.pileTopCardId,
    pendingPileCards: resolvedPile ? [] : state.pendingPileCards,
    lastDrawnCards: resolvedPile ? state.pendingPileCards.map(c => c.id) : state.lastDrawnCards,
    message: pendingMsg,
  };
}

function undoPilePickup(state: GameState): GameState {
  if (!state.pileTopCardId) return { ...state, message: 'Nothing to undo.' };
  const player = state.players[state.currentPlayer];
  const topCard = player.hand.find(c => c.id === state.pileTopCardId);
  if (!topCard) return { ...state, message: 'Pile top card not found.' };

  const hand = player.hand.filter(c => c.id !== state.pileTopCardId);
  const restoredPile = [...state.pendingPileCards, topCard];
  const restoredFrozen = restoredPile.some(c => isWild(c));

  const players: [PlayerState, PlayerState] = [...state.players] as [PlayerState, PlayerState];
  players[state.currentPlayer] = { ...player, hand };

  const log = [...state.log, `${state.currentPlayer === 0 ? 'You' : 'Computer'} returned the pile.`];

  return {
    ...state,
    players,
    discardPile: restoredPile,
    isDiscardFrozen: restoredFrozen || state.rules.frozenPile,
    turnPhase: 'draw',
    pileTopCardId: null,
    pendingPileCards: [],
    openingTurnMeldPoints: 0,
    lastDrawnCards: [],
    selectedCards: [],
    log,
    message: 'Draw from stock or pick up the discard pile.',
  };
}

function discardCard(state: GameState, cardId: string): GameState {
  if (state.turnPhase !== 'play') return { ...state, message: 'Draw first.' };
  const player = state.players[state.currentPlayer];
  const card = player.hand.find(c => c.id === cardId);
  if (!card) return { ...state, message: 'Card not in hand.' };

  if (isRed3(card)) return { ...state, message: 'Cannot discard Red 3.' };

  // Must meld pile top card before discarding
  if (state.pileTopCardId) {
    return { ...state, message: `Must meld the highlighted pile card before discarding.` };
  }
  // Pile top was melded but minimum not yet reached — must keep melding
  if (state.pendingPileCards.length > 0 && !player.hasOpenedMeld) {
    const min = initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);
    if (state.openingTurnMeldPoints < min) {
      return { ...state, message: `Meld ${min - state.openingTurnMeldPoints} more pts to receive the pile (${state.openingTurnMeldPoints}/${min}).` };
    }
  }

  // Opening meld requirement: if melds were made this turn but total is below minimum, block
  if (!player.hasOpenedMeld && state.openingTurnMeldPoints > 0) {
    const min = initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);
    if (state.openingTurnMeldPoints < min) {
      return { ...state, message: `Opening melds total ${state.openingTurnMeldPoints} pts — need ${min}. Add more melds.` };
    }
  }

  const hand = player.hand.filter(c => c.id !== cardId);
  const discardPile = [...state.discardPile, card];
  const isFrozen = isWild(card) ? true : state.isDiscardFrozen;

  const players: [PlayerState, PlayerState] = [...state.players] as [PlayerState, PlayerState];
  players[state.currentPlayer] = { ...player, hand };

  // Check going out
  if (hand.length === 0 && canGoOut(players[state.currentPlayer], state.rules)) {
    return resolveRound(
      { ...state, players, discardPile, isDiscardFrozen: isFrozen, selectedCards: [] },
      state.currentPlayer,
      false,
    );
  }

  const log = [...state.log];
  const next = state.currentPlayer === 0 ? 1 : 0;
  const isAI = next === 1;

  const who = state.currentPlayer === 0 ? 'You' : 'Computer';
  log.push(`${who} discarded ${cardLabel(card)}.${isWild(card) ? ' Pile frozen.' : ''}`);

  return {
    ...state,
    players,
    discardPile,
    isDiscardFrozen: isFrozen,
    currentPlayer: next as 0 | 1,
    turnPhase: 'draw',
    selectedCards: [],
    openingTurnMeldPoints: 0,
    pileTopCardId: null,
    pendingPileCards: [],
    log,
    aiThinking: isAI,
    message: isAI ? 'Computer is thinking…' : 'Your turn — draw or pick up pile.',
    undoSnapshot: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startRound({
        ...initialState(),
        rules: action.rules,
        aiDifficulty: action.difficulty,
      });

    case 'DRAW_FROM_STOCK':
      return drawFromStock(state);

    case 'PICKUP_DISCARD_PILE':
      return pickupDiscardPile(state);

    case 'TOGGLE_SELECT': {
      const already = state.selectedCards.includes(action.cardId);
      return {
        ...state,
        selectedCards: already
          ? state.selectedCards.filter(id => id !== action.cardId)
          : [...state.selectedCards, action.cardId],
      };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedCards: [] };

    case 'CREATE_MELD':
      return createMeld(state);

    case 'ADD_TO_MELD':
      return addToMeld(state, action.meldId);

    case 'DISCARD_CARD':
      return discardCard(state, action.cardId);

    // AI actions (same logic, different log names — reuse helpers)
    case 'AI_DRAW_STOCK':
      return drawFromStock(state);

    case 'AI_PICKUP_PILE':
      return pickupDiscardPile(state);

    case 'AI_CREATE_MELD':
      // Route through createMeld with selectedCards set
      return createMeld({ ...state, selectedCards: action.cardIds });

    case 'AI_ADD_TO_MELD':
      return addToMeld({ ...state, selectedCards: action.cardIds }, action.meldId);

    case 'AI_DISCARD':
      return discardCard(state, action.cardId);

    case 'UNDO_PILE_PICKUP':
      return undoPilePickup(state);

    case 'UNDO_TURN':
      if (!state.undoSnapshot) return state;
      return { ...state.undoSnapshot, undoSnapshot: null };

    case 'FORCE_GO_OUT': {
      // Check current player first
      const p = state.players[state.currentPlayer];
      if (p.hand.length === 0) {
        if (canGoOut(p, state.rules)) {
          return resolveRound(state, state.currentPlayer, !p.hasOpenedMeld);
        }
        return endTurn(state, false, false);
      }
      // Also check the other player (in case turn already passed after they emptied hand)
      const other = (1 - state.currentPlayer) as 0 | 1;
      const op = state.players[other];
      if (op.hand.length === 0 && canGoOut(op, state.rules)) {
        return resolveRound(state, other, !op.hasOpenedMeld);
      }
      return state;
    }

    case 'NEXT_ROUND':
      return startRound(state);

    case 'BACK_TO_MENU':
      return initialState();

    default:
      return state;
  }
}
