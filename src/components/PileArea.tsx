import CardSVG from './CardSVG';
import { Card } from '../engine/types';
import { isBlack3, isWild } from '../engine/deck';

interface Props {
  stock: Card[];
  discardPile: Card[];
  isFrozen: boolean;
  frozenCard?: Card;
  canPickup: boolean;
  pickupBlockReason?: string;
  onDrawStock?: () => void;
  onPickupPile?: () => void;
  onDropDiscard?: (e: React.DragEvent) => void;
  turnPhase: 'draw' | 'play';
  isPlayerTurn: boolean;
}

export default function PileArea({
  stock, discardPile, isFrozen, frozenCard, canPickup, pickupBlockReason,
  onDrawStock, onPickupPile, onDropDiscard,
  turnPhase, isPlayerTurn,
}: Props) {
  const topDiscard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isDrawPhase = turnPhase === 'draw' && isPlayerTurn;
  const discardBlocked = topDiscard && (isBlack3(topDiscard) || isWild(topDiscard));

  return (
    <div style={{
      display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', justifyContent: 'center', gap: 12,
    }}>
      {/* Stock pile */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Stock <span style={{ color: '#9ca3af', fontWeight: 600 }}>{stock.length}</span>
          </div>
          {isDrawPhase && stock.length > 0 && (
            <div style={{ fontSize: 10, color: '#3b82f6', animation: 'pulse 1.5s infinite' }}>
              Click to draw
            </div>
          )}
        </div>
        <div
          onClick={isDrawPhase ? onDrawStock : undefined}
          style={{
            cursor: isDrawPhase ? 'pointer' : 'default',
            opacity: stock.length === 0 ? 0.4 : 1,
            transition: 'transform 0.1s',
            transform: isDrawPhase && stock.length > 0 ? 'scale(1.04)' : 'scale(1)',
            filter: isDrawPhase ? 'drop-shadow(0 0 8px #3b82f6)' : 'none',
          }}
        >
          {stock.length > 0 ? (
            <svg width={70} height={100} viewBox="0 0 70 100">
              <rect x="4" y="4" width="66" height="95" rx="6" fill="#1e3a8a" opacity="0.4" />
              <rect x="2" y="2" width="66" height="95" rx="6" fill="#1e40af" opacity="0.6" />
              <rect x="1" y="1" width="68" height="98" rx="6" fill="#1e40af" stroke="#1e3a8a" strokeWidth="1.5" />
              <rect x="5" y="5" width="60" height="90" rx="4" fill="none" stroke="#3b82f6" strokeWidth="1" />
              <text x="35" y="56" textAnchor="middle" fontSize="28" fill="#3b82f6">★</text>
            </svg>
          ) : (
            <svg width={70} height={100} viewBox="0 0 70 100">
              <rect x="1" y="1" width="68" height="98" rx="6" fill="#111827" stroke="#374151" strokeWidth="1.5" strokeDasharray="4,3" />
              <text x="35" y="52" textAnchor="middle" fontSize="10" fill="#4b5563">EMPTY</text>
            </svg>
          )}
        </div>
      </div>

      {/* Discard pile */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <div
          onClick={isDrawPhase && canPickup ? onPickupPile : undefined}
          onDragOver={!isDrawPhase && isPlayerTurn ? (e) => e.preventDefault() : undefined}
          onDrop={!isDrawPhase && isPlayerTurn ? onDropDiscard : undefined}
          style={{
            cursor: isDrawPhase && canPickup ? 'pointer' : 'default',
            transition: 'transform 0.1s',
            transform: isDrawPhase && canPickup ? 'scale(1.04)' : 'scale(1)',
            filter: isDrawPhase && canPickup ? 'drop-shadow(0 0 8px #22c55e)' : 'none',
            minWidth: 70, minHeight: 100,
          }}
        >
          {topDiscard ? (
            <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isFrozen && frozenCard && frozenCard.id !== topDiscard.id && (
                <div style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%) rotate(90deg)',
                  opacity: 0.75,
                  zIndex: 0,
                }}>
                  <CardSVG card={frozenCard} />
                </div>
              )}
              <div key={topDiscard.id} style={{
                animation: 'cardDiscard 0.25s ease',
                position: 'relative', zIndex: 1,
                transform: (isFrozen && frozenCard?.id === topDiscard.id) ? 'rotate(90deg)' : undefined,
              }}>
                <CardSVG card={topDiscard} />
              </div>
            </div>
          ) : (
            <svg width={70} height={100} viewBox="0 0 70 100">
              <rect x="1" y="1" width="68" height="98" rx="6" fill="#111827"
                stroke="#374151" strokeWidth="1.5" strokeDasharray="4,3" />
              <text x="35" y="52" textAnchor="middle" fontSize="10" fill="#4b5563">EMPTY</text>
            </svg>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Discard <span style={{ color: '#9ca3af', fontWeight: 600 }}>{discardPile.length}</span>
            {isFrozen && <span style={{ color: '#ef4444', marginLeft: 4 }}>❄ Frozen</span>}
            {topDiscard && isBlack3(topDiscard) && <span style={{ color: '#f97316', marginLeft: 4 }}>⛔ Blocked</span>}
          </div>
          {isDrawPhase && canPickup && (
            <div style={{ fontSize: 10, color: '#22c55e', animation: 'pulse 1.5s infinite' }}>
              Click to pick up
            </div>
          )}
          {isDrawPhase && !canPickup && pickupBlockReason && (
            <div style={{ fontSize: 10, color: '#6b7280', maxWidth: 90, lineHeight: 1.3 }}>
              {pickupBlockReason}
            </div>
          )}
          {!isDrawPhase && isPlayerTurn && (
            <div style={{ fontSize: 10, color: '#6b7280' }}>
              Drag here to discard
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
