import { GameState } from '../engine/types';
import { scoreRound } from '../engine/scoring';
import { isNaturalCanasta, isCanasta } from '../engine/meld';

interface Props {
  state: GameState;
  onNextRound: () => void;
  onMenu: () => void;
}

function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function ScoreRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  if (value === 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: highlight ? '#f59e0b' : '#9ca3af' }}>
      <span>{label}</span>
      <span style={{ fontWeight: highlight ? 700 : 400, color: value < 0 ? '#ef4444' : highlight ? '#f59e0b' : '#e2e8f0' }}>
        {value > 0 ? '+' : ''}{fmt(value)}
      </span>
    </div>
  );
}

export default function RoundEndModal({ state, onNextRound, onMenu }: Props) {
  const lastResult = state.roundResults[state.roundResults.length - 1];
  if (!lastResult) return null;

  const isGameEnd = state.phase === 'gameEnd';
  const p0 = state.players[0];
  const p1 = state.players[1];

  // Re-compute breakdown
  const wentOut = lastResult.goingOutPlayer;
  const s0 = scoreRound(p0, wentOut === 0, lastResult.concealed && wentOut === 0, state.rules);
  const s1 = scoreRound(p1, wentOut === 1, lastResult.concealed && wentOut === 1, state.rules);

  const playerWon = lastResult.scores[0] > lastResult.scores[1];
  const tied = lastResult.scores[0] === lastResult.scores[1];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <div style={{
        background: '#111827', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
        border: '1px solid #1f2937', margin: '0 16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h2 style={{ margin: '0 0 4px', color: '#f0f9ff', fontSize: 22, fontWeight: 700 }}>
          {isGameEnd ? '🏆 Game Over' : `Round ${lastResult.roundNum} Complete`}
        </h2>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          {lastResult.goingOutPlayer !== null
            ? `${lastResult.goingOutPlayer === 0 ? 'You' : 'Computer'} went out`
            : 'Stock ran out'}
        </div>

        {/* Score breakdown side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[{ label: 'You', score: s0, total: lastResult.scores[0], running: lastResult.runningTotals[0] },
            { label: 'Computer', score: s1, total: lastResult.scores[1], running: lastResult.runningTotals[1] }
          ].map(({ label, score, total, running }) => (
            <div key={label} style={{
              background: '#0a0f1e', borderRadius: 10, padding: '12px 14px',
              border: '1px solid #1f2937',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>{label}</div>
              <ScoreRow label="Melded cards" value={score.meldedCards} />
              <ScoreRow label="Hand penalty" value={-score.handPenalty} />
              {score.naturalCanastas > 0 && <ScoreRow label={`Natural canastas ×${score.naturalCanastas / 600}`} value={score.naturalCanastas} highlight />}
              {score.mixedCanastas > 0 && <ScoreRow label={`Mixed canastas ×${score.mixedCanastas / 300}`} value={score.mixedCanastas} />}
              {score.wildCanastas > 0 && <ScoreRow label={`Wild canastas ×${score.wildCanastas / 2000}`} value={score.wildCanastas} />}
              <ScoreRow label="Red 3s" value={score.redThrees} />
              <ScoreRow label="Going out" value={score.goingOutBonus} highlight />
              <ScoreRow label="Concealed" value={score.concealedBonus} highlight />
              <div style={{ borderTop: '1px solid #1f2937', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>Round</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: total < 0 ? '#ef4444' : '#22c55e' }}>
                  {total > 0 ? '+' : ''}{fmt(total)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 12, color: '#4b5563' }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f9ff' }}>
                  {fmt(running)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {isGameEnd && (
          <div style={{
            textAlign: 'center', padding: '12px', borderRadius: 10, marginBottom: 16,
            background: state.winner === 0 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${state.winner === 0 ? '#3b82f6' : '#ef4444'}`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: state.winner === 0 ? '#3b82f6' : '#ef4444' }}>
              {state.winner === 0 ? '🎉 You Win!' : '💀 Computer Wins'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Final: You {fmt(lastResult.runningTotals[0])} — Computer {fmt(lastResult.runningTotals[1])}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onMenu} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #374151',
            background: 'transparent', color: '#9ca3af', fontSize: 14, cursor: 'pointer',
          }}>
            Main Menu
          </button>
          {!isGameEnd && (
            <button onClick={onNextRound} style={{
              flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Next Round →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
