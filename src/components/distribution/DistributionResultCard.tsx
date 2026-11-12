import { CircleCheck, Inbox, UserX } from 'lucide-react';
import { MESSAGES, originLabel } from '@/utils/constants';
import { formatDateTime, formatPhone } from '@/utils/format';
import type { DistributionResult } from '@/types/domain';

/** Resultado da última distribuição: lead, corretor e horário — ou o motivo de não ter distribuído. */
export function DistributionResultCard({ result }: { result: DistributionResult }) {
  if (result.status !== 'ok') {
    const Icon = result.status === 'no_leads' ? Inbox : UserX;
    return (
      <div role="alert" className="flex animate-pop items-start gap-3 rounded-card border border-amber-200 bg-warn-50 p-4">
        <Icon className="mt-0.5 size-5 shrink-0 text-warn-600" aria-hidden />
        <p className="text-sm font-medium text-amber-900">{result.status === 'no_leads' ? MESSAGES.noLeads : MESSAGES.noBrokers}</p>
      </div>
    );
  }

  return (
    <div role="status" className="animate-pop overflow-hidden rounded-card border border-mata-100 bg-surface shadow-card">
      <div className="flex items-center gap-2 bg-mata-50 px-4 py-2.5 text-sm font-semibold text-mata-700">
        <CircleCheck className="size-4" aria-hidden />
        Lead distribuído em {formatDateTime(result.distributedAt)}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted">Corretor selecionado</p>
          <p className="font-display text-[1.75rem] leading-tight text-navy-800">{result.broker.name}</p>
          <p className="text-xs tabular text-subtle">Posição {result.queuePosition} da fila</p>
        </div>
        <div className="sm:border-l sm:border-line sm:pl-4">
          <p className="text-xs text-muted">Lead</p>
          <p className="font-semibold text-ink">{result.lead.name}</p>
          <p className="text-sm tabular text-muted">{formatPhone(result.lead.phone)}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {originLabel(result.lead.origin)}: {result.lead.interest}
          </p>
        </div>
      </div>
    </div>
  );
}
