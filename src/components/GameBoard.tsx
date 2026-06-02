import { useReducer, useEffect, useRef, useState } from 'react';
import { gameReducer, initialState } from '../engine/gameReducer';
import { computeFullAITurn } from '../engine/ai';
import { canFormMeld, canAddToMeld, canGoOut, initialMeldMinimum, isCanasta } from '../engine/meld';
import { isWild, isBlack3 } from '../engine/deck';
import { GameState, Rules, AIDifficulty } from '../engine/types';
import Hand from './Hand';
import MeldArea from './MeldArea';
import PileArea from './PileArea';
import ScorePanel from './ScorePanel';
import GameLog from './GameLog';
import RoundEndModal from './RoundEndModal';

function playerCanPickup(state: GameState): boolean {
  const p = state.players[0];
  const pile = state.discardPile;
  if (pile.length === 0) return false;
  const top = pile[pile.length - 1];
  if (isBlack3(top) || isWild(top)) return false;
  const matching = p.hand.filter(c => c.rank === top.rank && !isWild(c));
  const effectivelyFrozen = state.isDiscardFrozen || state.rules.frozenPile;
  if (effectivelyFrozen) return matching.length >= 2;
  if (!p.hasOpenedMeld) return matching.length >= 2;
  if (p.melds.some(m => m.rank === top.rank && !isCanasta(m))) return true;
  return matching.length >= 2;
}

function getPickupBlockReason(state: GameState): string | undefined {
  const pile = state.discardPile;
  if (pile.length === 0) return undefined;
  const top = pile[pile.length - 1];
  const p = state.players[0];
  if (isBlack3(top)) return 'Black 3 blocks pile';
  if (isWild(top)) return 'Wild on top — cannot take';
  const matching = p.hand.filter(c => c.rank === top.rank && !isWild(c));
  const effectivelyFrozen = state.isDiscardFrozen || state.rules.frozenPile;
  if (effectivelyFrozen) {
    if (matching.length < 2) return `Frozen — need 2×${top.rank} in hand`;
    return undefined;
  }
  if (!p.hasOpenedMeld) {
    if (matching.length < 2) return `Need 2×${top.rank} in hand for opening meld`;
    return undefined;
  }
  if (p.melds.some(m => m.rank === top.rank)) return undefined;
  if (matching.length < 2) return `Need 2×${top.rank} in hand or existing ${top.rank} meld`;
  return undefined;
}

interface Props {
  initialRules: Rules;
  initialDifficulty: AIDifficulty;
  onMenu: () => void;
}

export default function GameBoard({ initialRules, initialDifficulty, onMenu }: Props) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    gameReducer(initialState(), { type: 'START_GAME', rules: initialRules, difficulty: initialDifficulty })
  );
  const [debug, setDebug] = useState(false);

  const aiRunning = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Auto-resolve: handle stuck 0-card states
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.pendingPileCards.length > 0) return;
    const current = state.players[state.currentPlayer];
    const other = state.players[(1 - state.currentPlayer) as 0 | 1];
    // Only fire for current player in PLAY phase (not draw phase — let them draw first)
    if (state.turnPhase === 'play' && current.hand.length === 0) {
      dispatch({ type: 'FORCE_GO_OUT' });
      return;
    }
    // Other player has 0 cards and can go out but turn already passed
    if (other.hand.length === 0 && canGoOut(other, state.rules)) {
      dispatch({ type: 'FORCE_GO_OUT' });
    }
  }, [state.phase, state.turnPhase, state.currentPlayer, state.players, state.pendingPileCards.length, state.rules]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '`') { e.preventDefault(); setDebug(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!state.aiThinking || state.phase !== 'playing' || aiRunning.current) return;
    aiRunning.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const delay = state.aiDifficulty === 'easy' ? 1000 : state.aiDifficulty === 'medium' ? 700 : 450;
    const actions = computeFullAITurn(state);

    actions.forEach((action, i) => {
      const tid = setTimeout(() => {
        dispatch(action);
        if (i === actions.length - 1) { aiRunning.current = false; }
      }, i * delay);
      timers.current.push(tid);
    });
  }, [state.aiThinking, state.currentPlayer]);

  const player = state.players[0];
  const computer = state.players[1];
  const isPlayerTurn = state.currentPlayer === 0;
  const selectedIds = state.selectedCards;

  const selectedCards = player.hand.filter(c => selectedIds.includes(c.id));
  const handAfterMeld = player.hand.filter(c => !selectedIds.includes(c.id));
  const goingOutAfterMeld = handAfterMeld.length === 0 || (handAfterMeld.length === 1 && isBlack3(handAfterMeld[0]));
  const canMeld = selectedCards.length >= 3 && canFormMeld(selectedCards, state.rules, goingOutAfterMeld);

  const eligibleMelds = player.melds.filter(meld =>
    selectedCards.length > 0 &&
    selectedCards.every(c => canAddToMeld(meld, c, state.rules))
  );

  const goOutEligible = canGoOut(player, state.rules) && isPlayerTurn && state.turnPhase === 'play';

  const playerMeldReq = initialMeldMinimum(player.totalScore, state.rules.harderFirstMeld);
  const computerMeldReq = initialMeldMinimum(computer.totalScore, state.rules.harderFirstMeld);
  const pickupBlockReason = (!playerCanPickup(state) && state.turnPhase === 'draw' && isPlayerTurn)
    ? getPickupBlockReason(state) : undefined;

  const handleCardSelect = (cardId: string) => {
    if (!isPlayerTurn || state.turnPhase !== 'play') return;
    dispatch({ type: 'TOGGLE_SELECT', cardId });
  };

  const handleDragStart = (cardId: string, e: React.DragEvent) => {
    e.dataTransfer.setData('cardId', cardId);
    if (!selectedIds.includes(cardId)) {
      dispatch({ type: 'TOGGLE_SELECT', cardId });
    }
  };

  const handleDropOnMeld = (meldId: string, e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (!cardId) return;
    if (!selectedIds.includes(cardId)) dispatch({ type: 'TOGGLE_SELECT', cardId });
    setTimeout(() => dispatch({ type: 'ADD_TO_MELD', meldId }), 0);
  };

  const handleDropDiscard = (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (cardId) dispatch({ type: 'DISCARD_CARD', cardId });
  };

  const handleDropMeldArea = (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (!cardId) return;
    if (!selectedIds.includes(cardId)) {
      dispatch({ type: 'TOGGLE_SELECT', cardId });
    }
    setTimeout(() => dispatch({ type: 'CREATE_MELD' }), 0);
  };

  return (
    <div style={{ zoom: 1.5, minHeight: '100vh', background: '#0a0f1e',
      fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 16px', background: '#0d1117', borderBottom: '1px solid #1f2937',
        flexShrink: 0,
      }}>
        <button onClick={onMenu} style={{
          background: 'transparent', border: '1px solid #374151', borderRadius: 6,
          color: '#6b7280', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
        }}>
          ← Menu
        </button>
        <div style={{
          fontSize: 13,
          color: state.message.includes('thinking') ? '#f87171' : '#93c5fd',
          background: state.message.includes('thinking') ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
          padding: '4px 14px', borderRadius: 20,
          border: `1px solid ${state.message.includes('thinking') ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`,
        }}>
          {state.message}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#4b5563' }}>Round {state.roundNum}</div>
          <button onClick={() => setDebug(v => !v)} style={{
            background: debug ? '#374151' : 'transparent', border: '1px solid #374151',
            borderRadius: 4, color: '#4b5563', fontSize: 10, padding: '2px 6px', cursor: 'pointer',
          }}>debug</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: '6px 12px', gap: 4, overflowY: 'auto', minWidth: 0,
        }}>
          {/* Computer hand */}
          <Hand
            cards={computer.hand}
            faceDown
            label="Computer"
            isCurrentTurn={!isPlayerTurn}
          />

          {/* Computer melds */}
          <div style={{ minHeight: 50, marginTop: 6 }}>
            <MeldArea
              melds={computer.melds}
              redThrees={computer.redThrees}
              label="Computer's melds"
              meldRequirement={computerMeldReq}
              hasOpened={computer.hasOpenedMeld}
            />
          </div>

          {/* Piles (center) */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '4px 0', borderTop: '1px solid #1f2937', borderBottom: '1px solid #1f2937',
          }}>
            <PileArea
              stock={state.stock}
              discardPile={state.discardPile}
              isFrozen={state.isDiscardFrozen}
              frozenCard={state.isDiscardFrozen ? [...state.discardPile].reverse().find(c => isWild(c)) : undefined}
              canPickup={playerCanPickup(state)}
              pickupBlockReason={pickupBlockReason}
              onDrawStock={() => dispatch({ type: 'DRAW_FROM_STOCK' })}
              onPickupPile={() => dispatch({ type: 'PICKUP_DISCARD_PILE' })}
              onDropDiscard={handleDropDiscard}
              turnPhase={state.turnPhase}
              isPlayerTurn={isPlayerTurn}
            />
            {isPlayerTurn && state.turnPhase === 'play' && state.undoSnapshot && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                {state.pileTopCardId && (
                  <div style={{
                    padding: '4px 10px', borderRadius: 8,
                    background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b',
                    color: '#f59e0b', fontSize: 11, fontWeight: 600,
                  }}>
                    ⚠ Meld the highlighted card first to receive the pile
                  </div>
                )}
                <button
                  onClick={() => dispatch({ type: 'UNDO_TURN' })}
                  style={{
                    padding: '4px 10px', borderRadius: 8, border: '1px solid #6b7280',
                    background: 'transparent', color: '#9ca3af', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  ↩ Undo turn
                </button>
              </div>
            )}
          </div>

          {/* Player melds (drop zone) */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropMeldArea}
            style={{ minHeight: 50 }}
          >
            <MeldArea
              melds={player.melds}
              redThrees={player.redThrees}
              label="Your melds"
              meldRequirement={playerMeldReq}
              meldProgress={isPlayerTurn ? state.openingTurnMeldPoints : 0}
              hasOpened={player.hasOpenedMeld}
              onMeldClick={(meldId) => {
                if (selectedIds.length > 0) dispatch({ type: 'ADD_TO_MELD', meldId });
              }}
              highlightMeldIds={eligibleMelds.map(m => m.id)}
              onDrop={handleDropOnMeld}
            />
          </div>

          {/* Action bar */}
          <div style={{ height: 50, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', alignContent: 'center' }}>
          {isPlayerTurn && state.turnPhase === 'play' && (<>
              <button
                disabled={!canMeld}
                onClick={() => dispatch({ type: 'CREATE_MELD' })}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  cursor: canMeld ? 'pointer' : 'not-allowed',
                  background: canMeld ? '#3b82f6' : '#1f2937',
                  color: canMeld ? 'white' : '#4b5563',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                Meld {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>

              {selectedIds.length === 1 && (
                <button
                  onClick={() => dispatch({ type: 'DISCARD_CARD', cardId: selectedIds[0] })}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#374151', color: '#e2e8f0', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Discard
                </button>
              )}

              {selectedIds.length > 0 && eligibleMelds.length > 0 && eligibleMelds.length === 1 && (
                <button
                  onClick={() => dispatch({ type: 'ADD_TO_MELD', meldId: eligibleMelds[0].id })}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#d97706', color: 'white', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Add to {eligibleMelds[0].rank}
                </button>
              )}

              {selectedIds.length > 0 && (
                <button
                  onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
                  style={{
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #374151',
                    background: 'transparent', color: '#6b7280', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}

              {goOutEligible && (
                <div style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e',
                  color: '#22c55e', fontSize: 11, fontWeight: 600,
                }}>
                  ✓ Can go out
                </div>
              )}
          </>)}
          </div>

          {/* Player hand */}
          <Hand
            cards={player.hand}
            selectedIds={selectedIds}
            highlightIds={state.lastDrawnCards}
            onSelect={handleCardSelect}
            onDragStart={handleDragStart}
            label="Your hand"
            isCurrentTurn={isPlayerTurn}
          />
        </div>

        {/* Sidebar */}
        <div style={{
          width: 192, flexShrink: 0, padding: '12px 12px 12px 0',
          display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto',
        }}>
          <ScorePanel
            players={state.players}
            roundResults={state.roundResults}
            rules={state.rules}
            currentPlayer={state.currentPlayer}
          />
          <GameLog log={state.log} />
        </div>
      </div>

      {debug && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000,
          display: 'flex', fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0',
          overflowY: 'auto', padding: 16, gap: 12,
        }} onClick={() => setDebug(false)}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Computer hand revealed */}
            <div style={{ background: '#111827', borderRadius: 8, padding: 12, minWidth: 200 }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>Computer hand ({computer.hand.length})</div>
              {computer.hand.map(c => <div key={c.id}>{c.rank}{c.suit ?? '★'}</div>)}
            </div>
            {/* Discard pile */}
            <div style={{ background: '#111827', borderRadius: 8, padding: 12, minWidth: 200 }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>Discard pile ({state.discardPile.length}) {state.isDiscardFrozen ? '❄' : ''}</div>
              {[...state.discardPile].reverse().map(c => <div key={c.id}>{c.rank}{c.suit ?? '★'}</div>)}
            </div>
            {/* Stock */}
            <div style={{ background: '#111827', borderRadius: 8, padding: 12, minWidth: 200 }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>Stock ({state.stock.length})</div>
              {state.stock.slice(0, 20).map(c => <div key={c.id}>{c.rank}{c.suit ?? '★'}</div>)}
              {state.stock.length > 20 && <div style={{ color: '#6b7280' }}>…+{state.stock.length - 20} more</div>}
            </div>
            {/* State flags */}
            <div style={{ background: '#111827', borderRadius: 8, padding: 12, minWidth: 220 }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>State</div>
              <div>phase: {state.phase}</div>
              <div>turnPhase: {state.turnPhase}</div>
              <div>currentPlayer: {state.currentPlayer}</div>
              <div>aiThinking: {String(state.aiThinking)}</div>
              <div>frozen: {String(state.isDiscardFrozen)}</div>
              <div>pileTopCardId: {state.pileTopCardId ?? 'none'}</div>
              <div>pendingPile: {state.pendingPileCards.length}</div>
              <div>openingPts: {state.openingTurnMeldPoints}</div>
              <div>round: {state.roundNum}</div>
              <div style={{ marginTop: 8, color: '#f59e0b', fontWeight: 700 }}>You</div>
              <div>hasOpened: {String(player.hasOpenedMeld)}</div>
              <div>hand: {player.hand.length} melds: {player.melds.length} r3: {player.redThrees.length}</div>
              <div style={{ marginTop: 8, color: '#f59e0b', fontWeight: 700 }}>Computer</div>
              <div>hasOpened: {String(computer.hasOpenedMeld)}</div>
              <div>hand: {computer.hand.length} melds: {computer.melds.length} r3: {computer.redThrees.length}</div>
            </div>
            {/* Rules */}
            <div style={{ background: '#111827', borderRadius: 8, padding: 12, minWidth: 200 }}>
              <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>Rules</div>
              {Object.entries(state.rules).map(([k, v]) => (
                <div key={k} style={{ color: v === true ? '#22c55e' : v === false ? '#4b5563' : '#e2e8f0' }}>
                  {k}: {String(v)}
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'fixed', top: 12, right: 20, color: '#6b7280', fontSize: 12 }}>
            ` or click to close
          </div>
        </div>
      )}

      {(state.phase === 'roundEnd' || state.phase === 'gameEnd') && (
        <RoundEndModal
          state={state}
          onNextRound={() => dispatch({ type: 'NEXT_ROUND' })}
          onMenu={onMenu}
        />
      )}
    </div>
  );
}
