import { Card, Meld, Rules } from './types';
import { isWild, isRed3, isBlack3, cardPointValue } from './deck';

let _counter = 0;
export function newMeldId(): string {
  return `m${++_counter}_${Date.now()}`;
}

export function canFormMeld(cards: Card[], rules: Rules, allowBlack3s = false): boolean {
  if (cards.length < 3) return false;
  const naturals = cards.filter(c => !isWild(c));
  const wilds = cards.filter(c => isWild(c));

  if (naturals.length === 0) return rules.wildCanastas;

  const rank = naturals[0].rank;
  if (isRed3(naturals[0])) return false;
  if (isBlack3(naturals[0])) {
    // Black 3s: only natural cards, no wilds, only on going-out turn
    if (!allowBlack3s) return false;
    if (wilds.length > 0) return false;
    return naturals.every(c => isBlack3(c));
  }
  if (!naturals.every(c => c.rank === rank)) return false;
  if (wilds.length > naturals.length) return false;
  if (wilds.length > 3) return false; // hard cap: max 3 wildcards per meld
  if (rules.strictWildCards && wilds.length > 2) return false;

  return true;
}

export function meldRank(cards: Card[]): Meld['rank'] {
  const naturals = cards.filter(c => !isWild(c));
  return naturals.length === 0 ? 'WILD' : naturals[0].rank;
}

export function meldPointValue(meld: Meld): number {
  return meld.cards.reduce((s, c) => s + cardPointValue(c), 0);
}

export function isCanasta(meld: Meld): boolean {
  return meld.cards.length >= 7;
}

export function isNaturalCanasta(meld: Meld): boolean {
  return meld.cards.length >= 7 && meld.cards.every(c => !isWild(c));
}

export function isWildCanasta(meld: Meld): boolean {
  return meld.rank === 'WILD' && meld.cards.length >= 7;
}

export function canAddToMeld(meld: Meld, card: Card, rules: Rules): boolean {
  if (meld.rank === 'WILD') return isWild(card);

  const mNats = meld.cards.filter(c => !isWild(c)).length;
  const mWilds = meld.cards.filter(c => isWild(c)).length;

  if (isWild(card)) {
    if (mWilds + 1 > mNats) return false;
    if (mWilds + 1 > 3) return false; // hard cap
    if (rules.strictWildCards) {
      if (mWilds + 1 > 2) return false;
      if (mNats < 5) return false;
    }
    return true;
  }
  // Can't add naturals to a black 3 meld after round start (handled at meld creation)
  return card.rank === meld.rank;
}

export function initialMeldMinimum(totalScore: number, harder: boolean): number {
  if (harder) {
    if (totalScore < 0) return 50;
    if (totalScore < 1500) return 90;
    if (totalScore < 3000) return 120;
    return 150;
  }
  if (totalScore < 0) return 15;
  if (totalScore < 1500) return 50;
  if (totalScore < 3000) return 90;
  return 120;
}

export function canGoOut(player: { melds: Meld[]; hand: Card[] }, rules: Rules): boolean {
  const canastas = player.melds.filter(m => isCanasta(m));
  if (rules.toughEnd) {
    return canastas.length >= 2 || canastas.some(m => isNaturalCanasta(m));
  }
  return canastas.length >= 1;
}
