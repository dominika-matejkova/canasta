import { Card } from '../engine/types';
import { isWild, cardPointValue } from '../engine/deck';
import CardSVG from './CardSVG';

const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'];

function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const aWild = isWild(a);
    const bWild = isWild(b);
    if (aWild !== bWild) return aWild ? -1 : 1;
    if (aWild && bWild) {
      if (a.rank === 'JK' && b.rank !== 'JK') return -1;
      if (b.rank === 'JK' && a.rank !== 'JK') return 1;
      return 0;
    }
    const av = cardPointValue(a);
    const bv = cardPointValue(b);
    if (av !== bv) return av - bv;
    return RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank);
  });
}

interface Props {
  cards: Card[];
  selectedIds?: string[];
  highlightIds?: string[];
  onSelect?: (cardId: string) => void;
  onDragStart?: (cardId: string, e: React.DragEvent) => void;
  faceDown?: boolean;
  label: string;
  redThrees?: Card[];
  isCurrentTurn?: boolean;
}

export default function Hand({
  cards, selectedIds = [], highlightIds = [], onSelect, onDragStart,
  faceDown, label, redThrees = [], isCurrentTurn,
}: Props) {
  const sorted = faceDown ? cards : sortHand(cards);
  const cardW = faceDown ? 28 : 90;
  const overlap = faceDown ? 14 : 30;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingLeft: 24, paddingRight: 24, paddingTop: 4,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: '#9ca3af', fontWeight: 500, marginBottom: 4,
      }}>
        <span style={{ color: isCurrentTurn ? '#f59e0b' : '#9ca3af' }}>
          {isCurrentTurn ? '▶ ' : ''}{label}
        </span>
        <span style={{
          background: '#1f2937', borderRadius: 12, padding: '1px 8px',
          fontSize: 11, color: '#6b7280',
        }}>
          {sorted.length} cards
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        {redThrees.length > 0 && (
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
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
        <div style={{
          position: 'relative',
          height: faceDown ? 40 : 140,
          width: sorted.length * overlap + (cardW - overlap) + 4,
          flexShrink: 0,
          marginTop: faceDown ? 4 : 14,
        }}>
          {sorted.map((card, i) => {
            const isSelected = selectedIds.includes(card.id);
            const isHighlighted = highlightIds.includes(card.id);
            return (
              <div
                key={card.id}
                style={{
                  position: 'absolute',
                  left: i * overlap,
                  top: isSelected ? -12 : 0,
                  transition: 'top 0.12s ease',
                  zIndex: i,
                  animation: isHighlighted ? 'cardDraw 0.35s ease' : undefined,
                }}
              >
                <CardSVG
                  card={card}
                  faceDown={faceDown}
                  tiny={faceDown}
                  large={!faceDown}
                  selected={isSelected}
                  highlighted={isHighlighted && !isSelected}
                  onClick={onSelect ? () => onSelect(card.id) : undefined}
                  draggable={!faceDown && !!onDragStart}
                  onDragStart={onDragStart ? (e) => onDragStart(card.id, e) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
