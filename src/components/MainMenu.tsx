import { useState, useEffect } from 'react';
import { Rules, DEFAULT_RULES, AIDifficulty } from '../engine/types';

interface Props {
  onStart: (rules: Rules, difficulty: AIDifficulty) => void;
}

function Toggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '8px 0', borderBottom: '1px solid #1f2937' }}>
      <div>
        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? '#3b82f6' : '#374151',
          transition: 'background 0.2s', position: 'relative', flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3,
          left: value ? 23 : 3, transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

const STORAGE_KEY = 'canasta-settings';

function loadSettings(): { rules: Rules; difficulty: AIDifficulty } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults so new rule fields don't come up undefined
      return {
        rules: { ...DEFAULT_RULES, ...parsed.rules },
        difficulty: parsed.difficulty ?? 'medium',
      };
    }
  } catch {}
  return { rules: DEFAULT_RULES, difficulty: 'medium' };
}

export default function MainMenu({ onStart }: Props) {
  const initial = loadSettings();
  const [rules, setRules] = useState<Rules>(initial.rules);
  const [difficulty, setDifficulty] = useState<AIDifficulty>(initial.difficulty);
  const [showRules, setShowRules] = useState(true);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rules, difficulty })); } catch {}
  }, [rules, difficulty]);

  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setRules(r => ({ ...r, [k]: v }));

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0f1e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🃏</div>
          <h1 style={{ margin: 0, fontSize: 42, fontWeight: 800, color: '#f0f9ff', letterSpacing: -1 }}>
            Canasta
          </h1>
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Player vs Computer</div>
        </div>

        <div style={{ background: '#111827', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #1f2937' }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            AI Difficulty
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: difficulty === d ? '#3b82f6' : '#1f2937',
                color: difficulty === d ? 'white' : '#9ca3af',
                fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                transition: 'all 0.2s',
              }}>
                {d}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 8, textAlign: 'center' }}>
            {difficulty === 'easy' && 'Random moves, occasionally smart'}
            {difficulty === 'medium' && 'Greedy play, builds melds efficiently'}
            {difficulty === 'hard' && 'Strategic — blocks opponent, targets canastas'}
          </div>
        </div>

        <div style={{ background: '#111827', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #1f2937' }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Game Length
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([5000, 10000] as const).map(score => (
              <button key={score} onClick={() => set('targetScore', score)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: rules.targetScore === score ? '#d97706' : '#1f2937',
                color: rules.targetScore === score ? 'white' : '#9ca3af',
                fontSize: 13, fontWeight: 600,
                transition: 'all 0.2s',
              }}>
                {score.toLocaleString()} pts
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#111827', borderRadius: 12, border: '1px solid #1f2937', marginBottom: 24 }}>
          <button
            onClick={() => setShowRules(v => !v)}
            style={{
              width: '100%', padding: '14px 20px', background: 'transparent', border: 'none',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              Rule Variants
            </span>
            <span style={{ color: '#6b7280', fontSize: 14 }}>{showRules ? '▲' : '▼'}</span>
          </button>
          {showRules && (
            <div style={{ padding: '0 20px 16px' }}>
              <Toggle label="Three Decks" desc="Use 3 decks (162 cards + 6 jokers = 168 total) instead of 2" value={rules.threeDecks} onChange={v => set('threeDecks', v)} />
              <Toggle label="Draw Two" desc="Draw 2 cards from stock each turn instead of 1" value={rules.drawTwo} onChange={v => set('drawTwo', v)} />
              <Toggle label="Wild Canastas" desc="Allow all-wildcard melds; completed = 2000 pts, incomplete = card values only" value={rules.wildCanastas} onChange={v => set('wildCanastas', v)} />
              <Toggle label="Tough End" desc="Need 2 canastas or at least 1 natural canasta to go out" value={rules.toughEnd} onChange={v => set('toughEnd', v)} />
              <Toggle label="Harder First Meld" desc="Opening meld minimums raised: 50/90/120/150 pts (standard: 15/50/90/120)" value={rules.harderFirstMeld} onChange={v => set('harderFirstMeld', v)} />
              <Toggle label="Strict Wild Cards" desc="Max 2 wildcards per meld; must have 5 natural cards in the meld before adding any wilds" value={rules.strictWildCards} onChange={v => set('strictWildCards', v)} />
              <Toggle label="Always Frozen Pile" desc="Pile is frozen from the start of every round (wildcards always freeze regardless)" value={rules.frozenPile} onChange={v => set('frozenPile', v)} />
              <Toggle label="Black 3 Penalty" desc="Black 3s left in hand at round end cost -100 pts each instead of -5" value={rules.blackThreePenalty} onChange={v => set('blackThreePenalty', v)} />
            </div>
          )}
        </div>

        <button
          onClick={() => onStart(rules, difficulty)}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
          }}
        >
          Deal Cards
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#374151' }}>
          2-player Classic Canasta · 2 decks + 4 jokers · 108 cards
        </div>
      </div>
    </div>
  );
}
