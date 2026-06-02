import { Card } from '../engine/types';
import { suitColor, suitSymbol, isWild, isRed3, isBlack3 } from '../engine/deck';

interface Props {
  card: Card;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  draggable?: boolean;
  tiny?: boolean;
  small?: boolean;
  medium?: boolean;
  large?: boolean;
  faceDown?: boolean;
}

const W = 70;
const H = 100;

function JokerFace() {
  return (
    <text x={W / 2} y={62} textAnchor="middle" fontSize="48" fill="url(#jokerGrad)">★</text>
  );
}

function WildTwoPip({ suit }: { suit: string }) {
  const color = suit === 'H' || suit === 'D' ? '#dc2626' : '#1a1a2e';
  return (
    <>
      <text x={W / 2} y={58} textAnchor="middle" fontSize="26" fontWeight="bold" fill={color}>
        {suit === 'H' ? '♥' : suit === 'D' ? '♦' : suit === 'S' ? '♠' : '♣'}
      </text>
    </>
  );
}

function NormalFace({ card }: { card: Card }) {
  const color = suitColor(card.suit);
  const sym = suitSymbol(card.suit);
  const isHighValue = ['A', 'K', 'Q', 'J'].includes(card.rank);

  return (
    <>
      <text x={W / 2} y={isHighValue ? 54 : 58} textAnchor="middle"
        fontSize={isHighValue ? "28" : "32"} fontWeight="bold" fill={color}>
        {sym}
      </text>
    </>
  );
}

export default function CardSVG({ card, selected, highlighted, onClick, onDragStart, draggable, tiny, small, medium, large, faceDown }: Props) {
  const cw = tiny ? 28 : small ? 44 : medium ? 66 : large ? 90 : W;
  const ch = tiny ? 40 : small ? 63 : medium ? 95 : large ? 128 : H;

  if (faceDown) {
    return (
      <svg width={cw} height={ch} viewBox={`0 0 ${W} ${H}`}
        style={{ cursor: 'default', flexShrink: 0, display: 'block' }}>
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="6" ry="6"
          fill="#1e40af" stroke="#1e3a8a" strokeWidth="1.5" />
        <rect x="5" y="5" width={W - 10} height={H - 10} rx="4" ry="4"
          fill="none" stroke="#3b82f6" strokeWidth="1" />
        <text x={W / 2} y={H / 2 + 8} textAnchor="middle" fontSize="28" fill="#3b82f6">★</text>
      </svg>
    );
  }

  const color = suitColor(card.suit);
  const sym = suitSymbol(card.suit);
  const isJoker = card.rank === 'JK';
  const isW2 = card.rank === '2' && !isJoker;
  const r3 = isRed3(card);
  const b3 = isBlack3(card);

  let borderColor = '#d1d5db';
  let bgColor = '#ffffff';
  let borderWidth = 1.5;
  if (selected) { borderColor = '#f59e0b'; bgColor = '#fef9e7'; borderWidth = 2.5; }
  else if (highlighted) { borderColor = '#22c55e'; borderWidth = 2.5; }
  else if (isJoker) borderColor = '#8b5cf6';
  else if (isW2) borderColor = '#7c3aed';
  else if (r3) borderColor = '#ef4444';

  const rank = card.rank === '10' ? '10' : card.rank;
  const cornerFont = rank === '10' ? '12' : '13';

  return (
    <div
      style={{ display: 'inline-block', flexShrink: 0, lineHeight: 0, cursor: onClick || draggable ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
    <svg
      width={cw}
      height={ch}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="jokerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* Card background */}
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="6" ry="6"
        fill={bgColor} stroke={borderColor} strokeWidth={borderWidth} />

      {/* Top-left rank + suit */}
      <text x="5" y="16" fontSize={cornerFont} fontWeight="bold" fill={isJoker ? '#8b5cf6' : color}>{isJoker ? '★' : rank}</text>
      {!isJoker && <text x="5" y="27" fontSize="11" fill={color}>{sym}</text>}

      {/* Center pip */}
      {isJoker ? <JokerFace /> : isW2 ? <WildTwoPip suit={card.suit!} /> : <NormalFace card={card} />}

      {/* Bottom-right (rotated) */}
      <g transform={`rotate(180, ${W / 2}, ${H / 2})`}>
        <text x="5" y="16" fontSize={cornerFont} fontWeight="bold" fill={isJoker ? '#8b5cf6' : color}>{isJoker ? '★' : rank}</text>
        {!isJoker && <text x="5" y="27" fontSize="11" fill={color}>{sym}</text>}
      </g>

      {/* Wild indicator badge — on 2s and jokers */}
      {(isW2 || isJoker) && (
        <rect x="46" y="2" width="22" height="10" rx="3" fill="#7c3aed" />
      )}
      {(isW2 || isJoker) && <text x="57" y="10" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">WILD</text>}
    </svg>
    </div>
  );
}
