import { GameState, GameAction, Card, Meld } from './types';
import { isWild, isRed3, isBlack3, cardPointValue } from './deck';
import {
  canFormMeld, meldRank, canAddToMeld, initialMeldMinimum,
  canGoOut, isCanasta, meldPointValue,
} from './meld';
import { gameReducer } from './gameReducer';

function canPickupPile(state: GameState): boolean {
  const player = state.players[1];
  const pile = state.discardPile;
  if (pile.length === 0) return false;
  const top = pile[pile.length - 1];
  if (isBlack3(top) || isWild(top)) return false;
  const matching = player.hand.filter(c => c.rank === top.rank && !isWild(c));
  const effectivelyFrozen = state.isDiscardFrozen || state.rules.frozenPile;
  if (effectivelyFrozen) return matching.length >= 2;
  if (!player.hasOpenedMeld) return matching.length >= 2;
  if (player.melds.some(m => m.rank === top.rank && !isCanasta(m))) return true;
  return matching.length >= 2;
}

function pileValue(pile: Card[]): number {
  return pile.reduce((s, c) => s + cardPointValue(c), 0);
}

function canOpenWithPile(state: GameState): boolean {
  const player = state.players[1];
  if (player.hasOpenedMeld) return true;
  const pile = state.discardPile;
  if (pile.length === 0) return false;
  const topCard = pile[pile.length - 1];
  const min = initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);
  const handWithTop = [...player.hand, topCard];
  const byRank = new Map<string, Card[]>();
  for (const c of handWithTop) {
    if (!isWild(c) && !isRed3(c) && !isBlack3(c)) {
      if (!byRank.has(c.rank)) byRank.set(c.rank, []);
      byRank.get(c.rank)!.push(c);
    }
  }
  const wilds = handWithTop.filter(c => isWild(c));
  let wildPool = [...wilds];
  let totalPoints = 0;
  for (const [, cards] of byRank) {
    let meldCards: Card[] = [];
    if (cards.length >= 3) {
      meldCards = cards.slice();
    } else if (cards.length === 2 && wildPool.length > 0) {
      meldCards = [...cards, wildPool[0]];
      wildPool = wildPool.slice(1);
    } else {
      continue;
    }
    if (canFormMeld(meldCards, state.rules)) {
      totalPoints += meldCards.reduce((s, c) => s + cardPointValue(c), 0);
    }
  }
  return totalPoints >= min;
}

function shouldPickupPile(state: GameState): boolean {
  if (!canPickupPile(state)) return false;
  if (!canOpenWithPile(state)) return false;
  const { aiDifficulty, discardPile, players } = state;
  const player = players[1];
  const top = discardPile[discardPile.length - 1];
  const val = pileValue(discardPile);
  const wouldFinishCanasta = player.melds.some(
    m => m.rank === top.rank && m.cards.length >= 5,
  );

  if (aiDifficulty === 'easy') return Math.random() < 0.35;
  if (aiDifficulty === 'medium') return val >= 25 || wouldFinishCanasta;

  // hard
  const newMeldCount = countNewMelds([...player.hand, ...discardPile], player.melds, state.rules);
  return val >= 20 || wouldFinishCanasta || newMeldCount > 0;
}

function countNewMelds(hand: Card[], existingMelds: Meld[], rules: GameState['rules']): number {
  const ranks = new Map<string, number>();
  for (const c of hand) {
    if (!isWild(c) && !isRed3(c) && !isBlack3(c)) {
      ranks.set(c.rank, (ranks.get(c.rank) || 0) + 1);
    }
  }
  const wilds = hand.filter(c => isWild(c)).length;
  let count = 0;
  for (const [rank, cnt] of ranks) {
    if (!existingMelds.some(m => m.rank === rank)) {
      if (cnt >= 3 || (cnt === 2 && wilds > 0)) count++;
    }
  }
  return count;
}

function computeMeldActions(state: GameState): GameAction[] {
  const actions: GameAction[] = [];
  const player = state.players[1];
  let hand = [...player.hand];
  // Track cumulative opening points for pile-pickup scenarios
  let cumulativeOpenPts = state.openingTurnMeldPoints;
  const needsOpening = !player.hasOpenedMeld;
  const min = initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);
  // When pile was picked up and top card not yet melded, we must meet minimum cumulatively
  const pileMode = needsOpening && (state.pileTopCardId !== null || state.pendingPileCards.length > 0);

  // If pile top card must be melded first, handle it
  if (state.pileTopCardId) {
    const topCard = hand.find(c => c.id === state.pileTopCardId);
    if (topCard) {
      // Try to add to existing meld of that rank
      const existingMeld = player.melds.find(m => m.rank === topCard.rank);
      if (existingMeld) {
        actions.push({ type: 'AI_ADD_TO_MELD', meldId: existingMeld.id, cardIds: [topCard.id] });
        hand = hand.filter(c => c.id !== topCard.id);
        cumulativeOpenPts += cardPointValue(topCard);
      } else {
        // Form new meld using top card + matching naturals + possibly wilds
        const matching = hand.filter(c => c.rank === topCard.rank && !isWild(c));
        const wilds = hand.filter(c => isWild(c));
        let meldCards = [...matching];
        if (meldCards.length < 3 && wilds.length > 0) meldCards = [...meldCards, wilds[0]];
        if (meldCards.length < 3 && wilds.length > 1) meldCards = [...meldCards, wilds[1]];
        if (canFormMeld(meldCards, state.rules)) {
          actions.push({ type: 'AI_CREATE_MELD', cardIds: meldCards.map(c => c.id) });
          hand = hand.filter(c => !meldCards.some(m => m.id === c.id));
          cumulativeOpenPts += meldCards.reduce((s, c) => s + cardPointValue(c), 0);
        }
      }
    }
  }

  // Add naturals to existing melds
  for (const meld of player.melds) {
    const naturals = hand.filter(c => c.rank === meld.rank && !isWild(c));
    if (naturals.length > 0) {
      const ids = naturals.map(c => c.id);
      actions.push({ type: 'AI_ADD_TO_MELD', meldId: meld.id, cardIds: ids });
      hand = hand.filter(c => !ids.includes(c.id));
      if (needsOpening) cumulativeOpenPts += naturals.reduce((s, c) => s + cardPointValue(c), 0);
    }
  }

  // Form new melds
  const byRank = new Map<string, Card[]>();
  for (const c of hand) {
    if (!isWild(c) && !isRed3(c) && !isBlack3(c)) {
      if (!byRank.has(c.rank)) byRank.set(c.rank, []);
      byRank.get(c.rank)!.push(c);
    }
  }
  const wilds = hand.filter(c => isWild(c));
  let wildPool = [...wilds];

  for (const [rank, cards] of byRank) {
    // Skip if an open (non-canasta) meld of this rank already exists
    if (player.melds.some(m => m.rank === rank && !isCanasta(m))) continue;

    let meldCards: Card[] = [];

    let wildsUsed = 0;
    if (cards.length >= 3) {
      meldCards = cards;
    } else if (cards.length === 2 && wildPool.length > 0) {
      meldCards = [...cards, wildPool[0]];
      wildsUsed = 1;
    } else {
      continue;
    }

    if (!canFormMeld(meldCards, state.rules)) continue;

    const val = meldCards.reduce((s, c) => s + cardPointValue(c), 0);
    if (needsOpening) {
      const wouldTotal = cumulativeOpenPts + val;
      if (wouldTotal < min) {
        if (pileMode) {
          // In pile mode: include this meld to build toward minimum cumulatively
        } else {
          // Try adding a wild (not already used) to boost value to meet minimum
          const availableWild = wildPool[wildsUsed];
          if (availableWild) {
            const boosted = [...meldCards, availableWild];
            const bval = boosted.reduce((s, c) => s + cardPointValue(c), 0);
            if (bval >= min && canFormMeld(boosted, state.rules)) {
              meldCards = boosted;
            } else {
              continue;
            }
          } else {
            continue;
          }
        }
      }
    }

    const ids = meldCards.map(c => c.id);
    actions.push({ type: 'AI_CREATE_MELD', cardIds: ids });
    hand = hand.filter(c => !ids.includes(c.id));
    wildPool = wildPool.filter(c => !ids.includes(c.id));
    if (needsOpening) cumulativeOpenPts += val;
  }

  return actions;
}

function chooseDiscard(state: GameState): string {
  const player = state.players[1];
  const hand = player.hand;
  if (hand.length === 0) return '';

  const difficulty = state.aiDifficulty;

  if (difficulty === 'easy') {
    const eligible = hand.filter(c => !isRed3(c));
    return eligible[Math.floor(Math.random() * eligible.length)]?.id ?? hand[0].id;
  }

  // Prefer black 3 to block pile when opponent has melds
  const black3 = hand.find(c => isBlack3(c));
  if (black3 && difficulty === 'hard' && state.players[0].melds.length > 0) return black3.id;
  if (black3 && difficulty === 'medium') return black3.id;

  const nonWilds = hand.filter(c => !isWild(c) && !isRed3(c));
  if (nonWilds.length === 0) {
    return hand.filter(c => !isRed3(c))
      .sort((a, b) => cardPointValue(a) - cardPointValue(b))[0].id;
  }

  const rankCounts = new Map<string, number>();
  for (const c of nonWilds) rankCounts.set(c.rank, (rankCounts.get(c.rank) || 0) + 1);

  const sorted = [...nonWilds].sort((a, b) => {
    const ac = rankCounts.get(a.rank) || 0;
    const bc = rankCounts.get(b.rank) || 0;
    if (ac !== bc) return ac - bc;
    return cardPointValue(a) - cardPointValue(b);
  });

  if (difficulty === 'hard') {
    for (const card of sorted) {
      const helpsOpponent = state.players[0].melds.some(m => m.rank === card.rank);
      if (!helpsOpponent) return card.id;
    }
  }

  return sorted[0].id;
}

// Simulate all possible melds and return whether AI can go out
function simulateCanGoOut(state: GameState): boolean {
  let sim = state;
  for (const a of computeMeldActions(sim)) {
    const next = gameReducer(sim, a);
    if (next.phase !== 'playing') return true; // went out in sim
    if (next.players[1].hand.length === 0 && !canGoOut(next.players[1], next.rules)) break;
    sim = next;
  }
  // Can go out if hand empty and meets canasta requirement, OR if 1 card left to discard
  const p = sim.players[1];
  return (p.hand.length === 0 && canGoOut(p, sim.rules)) ||
         (p.hand.length === 1 && canGoOut(p, sim.rules));
}

// Compute entire AI turn upfront by simulating state changes
export function computeFullAITurn(state: GameState): GameAction[] {
  let sim = state;

  // 1. Draw/pickup
  const drawAction: GameAction = shouldPickupPile(state)
    ? { type: 'AI_PICKUP_PILE' }
    : { type: 'AI_DRAW_STOCK' };
  sim = gameReducer(sim, drawAction);

  const inPileMode = sim.pileTopCardId !== null || sim.pendingPileCards.length > 0;
  const isStrategic = state.aiDifficulty === 'medium' || state.aiDifficulty === 'hard';
  const goingOut = isStrategic && simulateCanGoOut(sim);

  // 2. Melds — easy: always meld; medium/hard: only when picking up pile OR can go out
  const meldActions: GameAction[] = [];
  if (!isStrategic || inPileMode || goingOut) {
  for (const a of computeMeldActions(sim)) {
    const next = gameReducer(sim, a);
    if (next.phase !== 'playing') return [drawAction, ...meldActions, a]; // went out
    // Don't meld last card(s) if it would leave hand empty without canasta
    if (next.players[1].hand.length === 0 && !canGoOut(next.players[1], next.rules)) {
      break; // skip this and any further melds
    }
    meldActions.push(a);
    sim = next;
  }
  }

  // Safety net: pile still locked after all melds
  if (sim.pendingPileCards.length > 0) {
    // Undo pile pickup (restores turn phase to 'draw'), then draw from stock and finish turn
    const undoAction: GameAction = { type: 'UNDO_PILE_PICKUP' };
    const afterUndo = gameReducer(sim, undoAction);
    // afterUndo.turnPhase === 'draw' — must draw from stock before discarding
    const stockDraw: GameAction = { type: 'AI_DRAW_STOCK' };
    const afterDraw = gameReducer(afterUndo, stockDraw);
    const freshMelds: GameAction[] = [];
    let s2 = afterDraw;
    for (const a of computeMeldActions(s2)) {
      const next = gameReducer(s2, a);
      if (next.phase !== 'playing') return [drawAction, ...meldActions, undoAction, stockDraw, ...freshMelds, a];
      freshMelds.push(a);
      s2 = next;
    }
    const discardId = chooseDiscard(s2) || s2.players[1].hand.find(c => !c.id.startsWith('r3'))?.id || s2.players[1].hand[0].id;
    return [drawAction, ...meldActions, undoAction, stockDraw, ...freshMelds, { type: 'AI_DISCARD', cardId: discardId }];
  }

  // 3. Discard — must always happen if still playing
  if (sim.players[1].hand.length === 0) {
    return [drawAction, ...meldActions];
  }
  const discardId = chooseDiscard(sim) || sim.players[1].hand.find(c => !c.id.startsWith('r3'))?.id || sim.players[1].hand[0].id;
  const discardAction: GameAction = { type: 'AI_DISCARD', cardId: discardId };

  return [drawAction, ...meldActions, discardAction];
}
