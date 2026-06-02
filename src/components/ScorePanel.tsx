import { PlayerState, RoundResult } from '../engine/types';
import { canGoOut } from '../engine/meld';
import type { Rules } from '../engine/types';

interface Props {
  players: [PlayerState, PlayerState];
  roundResults: RoundResult[];
  rules: Rules;
  currentPlayer: 0 | 1;
}

export default function ScorePanel({ players, roundResults, rules, currentPlayer }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: '#111827', borderRadius: 10, padding: '10px 14px',
      border: '1px solid #1f2937', minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
        Score
      </div>

      {(['You', 'Computer'] as const).map((name, idx) => {
        const p = players[idx];
        const isActive = currentPlayer === idx;
        return (
          <div key={idx} style={{
            padding: '6px 8px', borderRadius: 6,
            background: isActive ? 'rgba(245,158,11,0.1)' : 'transparent',
            border: isActive ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: isActive ? '#f59e0b' : '#9ca3af', fontWeight: 600 }}>
                {isActive ? '▶ ' : ''}{name}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: p.totalScore < 0 ? '#ef4444' : '#f0f9ff' }}>
                {p.totalScore.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
              {p.melds.length} melds · {p.hand.length} in hand
              {p.redThrees.length > 0 && ` · ${p.redThrees.length} Red 3s`}
            </div>
            {!p.hasOpenedMeld && (
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                Needs opening meld
              </div>
            )}
            {canGoOut(p, rules) && (
              <div style={{ fontSize: 10, color: '#22c55e', marginTop: 1 }}>
                ✓ Can go out
              </div>
            )}
          </div>
        );
      })}

      <div style={{ borderTop: '1px solid #1f2937', paddingTop: 6, marginTop: 2 }}>
        <div style={{ fontSize: 10, color: '#6b7280' }}>
          Target: <span style={{ color: '#9ca3af', fontWeight: 600 }}>
            {rules.targetScore.toLocaleString()}
          </span>
        </div>
        <div style={{ marginTop: 4 }}>
          {([0, 1] as const).map(i => {
            const pct = Math.min(100, (players[i].totalScore / rules.targetScore) * 100);
            return (
              <div key={i} style={{ marginBottom: 3 }}>
                <div style={{
                  height: 4, background: '#1f2937', borderRadius: 2, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(0, pct)}%`,
                    background: i === 0 ? '#3b82f6' : '#ef4444',
                    transition: 'width 0.5s ease',
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {roundResults.length > 0 && (
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: 6 }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>Recent rounds</div>
          {roundResults.slice(-3).reverse().map(r => (
            <div key={r.roundNum} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4b5563' }}>
              <span>R{r.roundNum}</span>
              <span style={{ color: r.scores[0] > r.scores[1] ? '#22c55e' : '#9ca3af' }}>
                {r.scores[0] > 0 ? '+' : ''}{r.scores[0]}
              </span>
              <span style={{ color: r.scores[1] > r.scores[0] ? '#ef4444' : '#9ca3af' }}>
                {r.scores[1] > 0 ? '+' : ''}{r.scores[1]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
