export type Suit = 'H' | 'D' | 'S' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JK';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit | null;
}

export interface Meld {
  id: string;
  rank: Rank | 'WILD';
  cards: Card[];
}

export interface Rules {
  targetScore: 5000 | 10000 | 15000;
  drawTwo: boolean;
  wildCanastas: boolean;
  toughEnd: boolean;
  extremeEnd: boolean;
  harderFirstMeld: boolean;
  strictWildCards: boolean;
  blackThreePenalty: boolean;
  frozenPile: boolean;
  threeDecks: boolean;
}

export const DEFAULT_RULES: Rules = {
  targetScore: 5000,
  drawTwo: false,
  wildCanastas: false,
  toughEnd: false,
  extremeEnd: false,
  harderFirstMeld: false,
  strictWildCards: false,
  blackThreePenalty: false,
  frozenPile: false,
  threeDecks: false,
};

export type TurnPhase = 'draw' | 'play';
export type GamePhase = 'menu' | 'playing' | 'roundEnd' | 'gameEnd';
export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface PlayerState {
  hand: Card[];
  melds: Meld[];
  redThrees: Card[];
  totalScore: number;
  hasOpenedMeld: boolean;
}

export interface RoundResult {
  roundNum: number;
  scores: [number, number];
  runningTotals: [number, number];
  goingOutPlayer: 0 | 1 | null;
  concealed: boolean;
  stockEmpty: boolean;
}

export interface GameState {
  phase: GamePhase;
  rules: Rules;
  stock: Card[];
  discardPile: Card[];
  players: [PlayerState, PlayerState];
  currentPlayer: 0 | 1;
  turnPhase: TurnPhase;
  isDiscardFrozen: boolean;
  selectedCards: string[];
  log: string[];
  roundResults: RoundResult[];
  roundNum: number;
  aiDifficulty: AIDifficulty;
  winner: 0 | 1 | null;
  aiThinking: boolean;
  message: string;
  lastDrawnCards: string[];
  openingTurnMeldPoints: number;
  pileTopCardId: string | null;
  pendingPileCards: Card[];
  undoSnapshot: Omit<GameState, 'undoSnapshot'> | null;
}

export type GameAction =
  | { type: 'START_GAME'; rules: Rules; difficulty: AIDifficulty }
  | { type: 'DRAW_FROM_STOCK' }
  | { type: 'PICKUP_DISCARD_PILE' }
  | { type: 'TOGGLE_SELECT'; cardId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CREATE_MELD' }
  | { type: 'ADD_TO_MELD'; meldId: string }
  | { type: 'DISCARD_CARD'; cardId: string }
  | { type: 'AI_DRAW_STOCK' }
  | { type: 'AI_PICKUP_PILE' }
  | { type: 'AI_CREATE_MELD'; cardIds: string[] }
  | { type: 'AI_ADD_TO_MELD'; meldId: string; cardIds: string[] }
  | { type: 'AI_DISCARD'; cardId: string }
  | { type: 'UNDO_PILE_PICKUP' }
  | { type: 'UNDO_TURN' }
  | { type: 'FORCE_GO_OUT' }
  | { type: 'NEXT_ROUND' }
  | { type: 'BACK_TO_MENU' };
