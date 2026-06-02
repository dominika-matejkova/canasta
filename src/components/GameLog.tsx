import { useEffect, useRef } from 'react';

interface Props {
  log: string[];
}

export default function GameLog({ log }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  return (
    <div style={{
      background: '#111827', borderRadius: 10, padding: '8px 10px',
      border: '1px solid #1f2937', minWidth: 180,
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        Log
      </div>
      <div ref={ref} style={{
        maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {log.slice(-40).map((entry, i) => (
          <div key={i} style={{
            fontSize: 11, color: entry.startsWith('---') ? '#f59e0b' : '#6b7280',
            fontWeight: entry.startsWith('---') ? 600 : 400,
            borderBottom: entry.startsWith('---') ? '1px solid #1f2937' : 'none',
            paddingBottom: entry.startsWith('---') ? 2 : 0,
          }}>
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}
