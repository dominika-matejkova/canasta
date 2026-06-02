import { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['H', 'D', 'S', 'C'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function makeDeck(idx: number): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${rank}${suit}${idx}`, rank, suit });
    }
  }
  cards.push({ id: `JK0${idx}`, rank: 'JK', suit: null });
  cards.push({ id: `JK1${idx}`, rank: 'JK', suit: null });
  return cards;
}

export function createShuffledDeck(deckCount = 2): Card[] {
  const deck = Array.from({ length: deckCount }, (_, i) => makeDeck(i)).flat();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function isWild(card: Card): boolean {
  return card.rank === 'JK' || card.rank === '2';
}

export function isRed3(card: Card): boolean {
  return card.rank === '3' && (card.suit === 'H' || card.suit === 'D');
}

export function isBlack3(card: Card): boolean {
  return card.rank === '3' && (card.suit === 'S' || card.suit === 'C');
}

export function cardPointValue(card: Card): number {
  if (card.rank === 'JK') return 50;
  if (card.rank === '2' || card.rank === 'A') return 20;
  if (['K', 'Q', 'J', '10', '9', '8'].includes(card.rank)) return 10;
  return 5;
}

export function cardLabel(card: Card): string {
  if (card.rank === 'JK') return 'JK★';
  const sym = card.suit === 'H' ? '♥' : card.suit === 'D' ? '♦' : card.suit === 'S' ? '♠' : '♣';
  return `${card.rank}${sym}`;
}

export function suitColor(suit: Suit | null): string {
  if (!suit) return '#8b5cf6'; // joker purple
  return suit === 'H' || suit === 'D' ? '#dc2626' : '#1a1a2e';
}

export function suitSymbol(suit: Suit | null): string {
  if (!suit) return '🃏';
  const map: Record<Suit, string> = { H: '♥', D: '♦', S: '♠', C: '♣' };
  return map[suit];
}
