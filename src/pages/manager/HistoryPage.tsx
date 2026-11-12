import { useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, History } from 'lucide-react';
import { useDistributionHistory } from '@/hooks/useDistribution';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatDate, formatTime } from '@/utils/format';

export default function HistoryPage() {
  const [ascending, setAscending] = useState(false);
  const history = useDistributionHistory(ascending);
  const SortIcon = ascending ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <>
      <PageHeader
        title="Histórico de distribuições"
        description="Cada lead entregue pela roleta, com o corretor e o horário."
        actions={
          <Button variant="outline" onClick={() => setAscending((v) => !v)} aria-label={`Ordenar por data: ${ascending ? 'mais antigas primeiro' : 'mais recentes primeiro'}`}>
            <SortIcon aria-hidden />
            {ascending ? 'Mais antigas primeiro' : 'Mais recentes primeiro'}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {history.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : history.isError ? (
          <div className="p-5">
            <ErrorState message={history.error.message} onRetry={() => void history.refetch()} />
          </div>
        ) : (history.data?.length ?? 0) === 0 ? (
          <EmptyState icon={History} title="Nenhuma distribuição ainda" description="As distribuições feitas pela roleta aparecem aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-canvas/60 text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Lead</th>
                  <th scope="col" className="px-5 py-3 font-medium">Corretor</th>
                  <th scope="col" className="px-5 py-3 font-medium" aria-sort={ascending ? 'ascending' : 'descending'}>
                    <button type="button" onClick={() => setAscending((v) => !v)} className="inline-flex items-center gap-1 font-medium hover:text-ink">
                      Data e horário
                      <SortIcon className="size-3.5" aria-hidden />
                    </button>
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Posição na fila</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.data?.map((h) => (
                  <tr key={h.id}>
                    <td className="px-5 py-3 font-semibold text-ink">{h.lead?.name ?? 'Lead removido'}</td>
                    <td className="px-5 py-3">{h.broker?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular">
                      {formatDate(h.distributed_at)} <span className="text-muted">às {formatTime(h.distributed_at)}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular text-muted">{h.queue_position_at_distribution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {history.data && history.data.length >= 200 && <p className="mt-3 text-xs text-subtle">Exibindo os 200 registros mais {ascending ? 'antigos' : 'recentes'}.</p>}
    </>
  );
}
