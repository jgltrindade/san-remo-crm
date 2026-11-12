import { useEffect, useState } from 'react';
import { firstName, initials } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { BrokerPresence } from '@/types/domain';

interface QueueRingProps {
  /** Corretores habilitados (presença válida). */
  brokers: BrokerPresence[];
  /** Corretor que acabou de receber um lead (destaque). */
  highlightId?: string | null;
}

const SIZE = 360;
const C = SIZE / 2;
const R = 118;
const NODE = 23;

/**
 * Fila circular. Cada corretor ocupa sua posição fixa (queue_rank) no anel,
 * em sentido horário a partir do topo. O ponteiro aponta para o próximo da vez
 * e sempre avança no sentido horário — inclusive ao voltar ao início da fila.
 */
export function QueueRing({ brokers, highlightId }: QueueRingProps) {
  const ordered = [...brokers].sort((a, b) => (a.queue_rank ?? 0) - (b.queue_rank ?? 0));
  const n = ordered.length;
  const nextIndex = ordered.findIndex((b) => b.is_next);
  const next = nextIndex >= 0 ? ordered[nextIndex] : undefined;
  const target = n > 0 && nextIndex >= 0 ? (360 * nextIndex) / n : 0;

  // Rotação acumulada: avança sempre para frente (ex.: 240° -> 0° vira 240° -> 360°).
  const [rotation, setRotation] = useState(target);
  useEffect(() => {
    setRotation((prev) => prev + ((((target - prev) % 360) + 360) % 360));
  }, [target]);

  const pos = (i: number, radius = R) => {
    const a = ((360 * i) / n - 90) * (Math.PI / 180);
    return { x: C + Math.cos(a) * radius, y: C + Math.sin(a) * radius };
  };

  return (
    <figure className="mx-auto w-full max-w-[22rem]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label={n === 0 ? 'Fila vazia' : `Fila com ${n} corretores. Próximo: ${next?.name ?? '—'}`}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--color-line)" strokeWidth={2} />
        <circle cx={C} cy={C} r={R - 34} fill="none" stroke="var(--color-line)" strokeWidth={1} strokeDasharray="3 8" />

        {n > 0 && next && (
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${C}px ${C}px`, transition: 'transform 700ms cubic-bezier(0.3, 0.9, 0.3, 1.1)' }}>
            <line x1={C} y1={C} x2={C} y2={C - R + NODE + 8} stroke="var(--color-mata-600)" strokeWidth={3} strokeLinecap="round" />
            <path d={`M ${C - 7} ${C - R + NODE + 16} L ${C} ${C - R + NODE + 4} L ${C + 7} ${C - R + NODE + 16} Z`} fill="var(--color-mata-600)" />
          </g>
        )}
        <circle cx={C} cy={C} r={7} fill="var(--color-navy-800)" />

        {ordered.map((b, i) => {
          const { x, y } = pos(i);
          // rótulo para fora do anel, na direção radial do corretor
          const label = pos(i, R + NODE + 20);
          const isNext = b.is_next;
          const isHighlight = b.broker_id === highlightId;
          return (
            <g key={b.broker_id}>
              {isHighlight && <circle cx={x} cy={y} r={NODE + 7} fill="none" stroke="var(--color-mata-500)" strokeWidth={2} className="animate-pulse" />}
              <circle
                cx={x}
                cy={y}
                r={NODE}
                fill={isNext ? 'var(--color-navy-800)' : 'var(--color-surface)'}
                stroke={isNext ? 'var(--color-navy-800)' : 'var(--color-line-strong)'}
                strokeWidth={1.5}
              />
              <text x={x} y={y + 4.5} textAnchor="middle" className={cn('text-[13px] font-semibold', isNext ? 'fill-white' : 'fill-navy-700')}>
                {initials(b.name)}
              </text>
              <text x={label.x} y={label.y + 4} textAnchor="middle" className="fill-muted text-[12px]">
                {b.queue_rank}. {firstName(b.name)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-1 text-center text-sm text-muted">
        {n === 0 ? (
          'Nenhum corretor com presença válida'
        ) : (
          <>
            Próximo da vez: <strong className="font-semibold text-ink">{next?.name}</strong>
          </>
        )}
      </figcaption>
    </figure>
  );
}
