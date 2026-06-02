import { PlayerState, Rules } from './types';
import { isWild, cardPointValue, isBlack3 } from './deck';
import { meldPointValue, isCanasta, isNaturalCanasta, isWildCanasta } from './meld';

export interface RoundScore {
  meldedCards: number;
  handPenalty: number;
  naturalCanastas: number;
  mixedCanastas: number;
  wildCanastas: number;
  redThrees: number;
  goingOutBonus: number;
  concealedBonus: number;
  total: number;
}

export function scoreRound(
  player: PlayerState,
  wentOut: boolean,
  wentOutConcealed: boolean,
  rules: Rules,
): RoundScore {
  const meldedCards = player.melds.reduce((s, m) => {
    if (m.rank === '3' && m.cards.every(c => isBlack3(c))) {
      // Black 3s melded on going-out turn: 50 pts each instead of 5
      return s + m.cards.length * 50;
    }
    return s + meldPointValue(m);
  }, 0);

  const handPenalty = player.hand.reduce((s, c) => {
    if (isBlack3(c)) return s + (rules.blackThreePenalty ? 100 : 5);
    return s + cardPointValue(c);
  }, 0);

  let naturalCanastas = 0;
  let mixedCanastas = 0;
  let wildCanastas = 0;

  for (const meld of player.melds) {
    if (meld.rank === 'WILD') {
      if (isWildCanasta(meld)) wildCanastas += 2000;
      // incomplete wild canasta: card values already counted in meldedCards, no extra penalty
    } else if (isNaturalCanasta(meld)) {
      naturalCanastas += 600;
    } else if (isCanasta(meld)) {
      mixedCanastas += 300;
    }
  }

  // Red 3s are positive if player has melds OR went out (going out always means melds exist,
  // and the concealed bonus applies independently — red 3s auto-placed never affect meld status)
  const hasMelds = player.melds.length > 0 || wentOut;
  const r3count = player.redThrees.length;
  const r3base = r3count === 4 ? 400 : r3count * 100;
  const redThrees = hasMelds ? r3base : -r3base;

  const goingOutBonus = wentOut ? 100 : 0;
  const concealedBonus = wentOutConcealed ? 300 : 0;

  const total =
    meldedCards
    - handPenalty
    + naturalCanastas
    + mixedCanastas
    + wildCanastas
    + redThrees
    + goingOutBonus
    + concealedBonus;

  return {
    meldedCards,
    handPenalty,
    naturalCanastas,
    mixedCanastas,
    wildCanastas,
    redThrees,
    goingOutBonus,
    concealedBonus,
    total,
  };
}
