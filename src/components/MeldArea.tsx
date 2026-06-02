import { Meld, Card, Rank, Suit } from '../engine/types';
import { isWild } from '../engine/deck';
import CardSVG from './CardSVG';
import { meldPointValue, isCanasta, isNaturalCanasta, isWildCanasta } from '../engine/meld';

const MELD_RANK_ORDER: Record<string, number> = {
  '4': 0, '5': 1, '6': 2, '7': 3, '8': 4, '9': 5,
  '10': 6, 'J': 7, 'Q': 8, 'K': 9, 'A': 10,
  '2': 11, 'JK': 12, 'WILD': 13,
};

interface Props {
  melds: Meld[];
  redThrees?: Card[];
  label: string;
  meldRequirement?: number;
  meldProgress?: number;
  hasOpened?: boolean;
  onMeldClick?: (meldId: string) => void;
  highlightMeldIds?: string[];
  onDrop?: (meldId: string, e: React.DragEvent) => void;
}

function MeldBadge({ meld }: { meld: Meld }) {
  if (isNaturalCanasta(meld)) return (
    <span style={{ background: '#d97706', color: 'white', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
      NATURAL
    </span>
  );
  if (isWildCanasta(meld)) return (
    <span style={{ background: '#7c3aed', color: 'white', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
      WILD
    </span>
  );
  if (isCanasta(meld)) return (
    <span style={{ background: '#2563eb', color: 'white', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
      CANASTA
    </span>
  );
  return null;
}

export default function MeldArea({ melds, redThrees = [], label, meldRequirement, meldProgress = 0, hasOpened, onMeldClick, highlightMeldIds = [], onDrop }: Props) {
  const showReq = !hasOpened && meldRequirement != null;

  if (melds.length === 0 && redThrees.length === 0) return (
    <div style={{ fontSize: 12, color: '#4b5563', padding: '4px 8px' }}>
      {label} — no melds yet
      {showReq && (
        <span style={{ marginLeft: 8, color: '#6b7280' }}>
          (opening meld: <span style={{ color: '#f59e0b' }}>{meldProgress}/{meldRequirement}</span> pts)
        </span>
      )}
    </div>
  );

  const runningScore = (() => {
    let s = melds.reduce((acc, m) => acc + meldPointValue(m), 0);
    for (const m of melds) {
      if (isNaturalCanasta(m)) s += 600;
      else if (isWildCanasta(m)) s += 2000;
      else if (isCanasta(m)) s += 300;
    }
    const hasMelds = melds.length > 0;
    if (hasMelds && redThrees.length > 0) s += redThrees.length === 4 ? 400 : redThrees.length * 100;
    return s;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{label}</span>
        {(melds.length > 0 || redThrees.length > 0) && (
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {runningScore > 0 ? '+' : ''}{runningScore} pts
          </span>
        )}
        {showReq && (
          <span style={{
            fontSize: 11, padding: '1px 7px', borderRadius: 10,
            background: meldProgress >= meldRequirement! ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
            color: meldProgress >= meldRequirement! ? '#22c55e' : '#f59e0b',
            border: `1px solid ${meldProgress >= meldRequirement! ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
          }}>
            opening: {meldProgress}/{meldRequirement} pts
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 10, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 2 }}>

      {/* Red 3s */}

      {redThrees.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: 4, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <div style={{ position: 'relative', height: 95, width: redThrees.length * 22 + (66 - 22) + 4 }}>
            {redThrees.map((c, i) => (
              <div key={c.id} style={{ position: 'absolute', left: i * 22, top: 0, zIndex: i }}>
                <CardSVG card={c} medium />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: '#ef4444' }}>
            +{redThrees.length === 4 ? 400 : redThrees.length * 100}pts
          </span>
        </div>
      )}
        {[...melds].sort((a, b) => (MELD_RANK_ORDER[a.rank] ?? 99) - (MELD_RANK_ORDER[b.rank] ?? 99)).map(meld => {
          const isHighlighted = highlightMeldIds.includes(meld.id);
          const splayOverlap = 22;
          const cardW = 66;
          const cardH = 95;

          return (
            <div
              key={meld.id}
              onClick={() => onMeldClick?.(meld.id)}
              onDragOver={onDrop ? (e) => e.preventDefault() : undefined}
              onDrop={onDrop ? (e) => onDrop(meld.id, e) : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: onMeldClick ? 'pointer' : 'default',
                padding: 4,
                borderRadius: 6,
                border: isHighlighted ? '2px solid #f59e0b' : '1px solid transparent',
                background: isHighlighted ? 'rgba(245,158,11,0.1)' : 'transparent',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Splay or canasta stack */}
              {isCanasta(meld) ? (() => {
                const natural = isNaturalCanasta(meld);
                const wild = isWildCanasta(meld);
                const indicatorSuit: Suit = natural ? 'H' : 'S';
                const indicatorRank: Rank = (meld.rank === 'WILD' ? 'JK' : meld.rank) as Rank;
                const indicatorCard: Card = { id: `ind_${meld.id}`, rank: indicatorRank, suit: wild ? null : indicatorSuit };
                return (
                  <div style={{ position: 'relative', width: cardW + 10, height: cardH + 10 }}>
                    <div style={{ position: 'absolute', left: 8, top: 8, opacity: 0.35 }}>
                      <CardSVG card={indicatorCard} medium faceDown />
                    </div>
                    <div style={{ position: 'absolute', left: 4, top: 4, opacity: 0.65 }}>
                      <CardSVG card={indicatorCard} medium faceDown />
                    </div>
                    <div style={{ position: 'absolute', left: 0, top: 0 }}>
                      <CardSVG card={indicatorCard} medium />
                    </div>
                    <div style={{ position: 'absolute', top: -6, right: -6, zIndex: 10 }}>
                      <MeldBadge meld={meld} />
                    </div>
                  </div>
                );
              })() : (
              <div style={{
                position: 'relative',
                height: cardH,
                width: meld.cards.length * splayOverlap + (cardW - splayOverlap) + 4,
              }}>
                {[...meld.cards].sort((a, b) => {
                  const aw = isWild(a), bw = isWild(b);
                  return aw === bw ? 0 : aw ? 1 : -1;
                }).map((card, i) => (
                  <div key={card.id} style={{ position: 'absolute', left: i * splayOverlap, top: 0, zIndex: i, animation: 'cardMeld 0.3s ease' }}>
                    <CardSVG card={card} medium />
                  </div>
                ))}
              </div>
              )}

              {/* Meld info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#6b7280' }}>
                  {meld.rank} ×{meld.cards.length} ({meldPointValue(meld)}pts)
                </span>
                {!isCanasta(meld) && <MeldBadge meld={meld} />}
              </div>
            </div>
          );
        })}
      </div>{/* flex wrap row */}
    </div>
  );
}
