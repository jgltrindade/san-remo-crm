import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/ui/feedback';

export interface Metric {
  label: string;
  value: number | string;
  hint?: string;
  /** cor do marcador à esquerda do rótulo */
  tone?: string;
  emphasis?: boolean;
}

/**
 * Faixa única de indicadores (em vez de vários cards idênticos): números
 * grandes e tabulares; as divisórias são o próprio fundo aparecendo no gap.
 */
export function MetricStrip({ metrics, loading }: { metrics: Metric[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3 xl:grid-cols-6">
      {metrics.map((m) => (
        <div key={m.label} className={cn('bg-surface px-5 py-5', m.emphasis && 'bg-[#f8fafc]')}>
          <p className="flex items-center gap-2 text-[13px] text-muted">
            {m.tone && <span className="size-2 rounded-full" style={{ background: m.tone }} aria-hidden />}
            {m.label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-16" />
          ) : (
            <p className="mt-1.5 text-[2.125rem] font-semibold leading-none tracking-tight tabular text-navy-800">{m.value}</p>
          )}
          {m.hint && !loading && <p className="mt-1.5 text-xs text-subtle">{m.hint}</p>}
        </div>
      ))}
    </div>
  );
}
