import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Shuffle } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { usePresenceOverview } from '@/hooks/usePresence';
import { useDistributeNextLead, useDistributionHistory } from '@/hooks/useDistribution';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueueRing } from '@/components/distribution/QueueRing';
import { DistributionResultCard } from '@/components/distribution/DistributionResultCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { MESSAGES, originLabel } from '@/utils/constants';
import { formatShortDateTime } from '@/utils/format';
import type { DistributionResult } from '@/types/domain';

export default function DistributionPage() {
  const leads = useLeads();
  const overview = usePresenceOverview();
  const history = useDistributionHistory(false);
  const distribute = useDistributeNextLead();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<DistributionResult | null>(null);

  const eligible = useMemo(() => overview.data?.filter((b) => b.is_valid) ?? [], [overview.data]);
  const next = eligible.find((b) => b.is_next);
  // Prévia informativa (o servidor decide de fato na transação).
  const reservoir = useMemo(
    () =>
      (leads.data ?? [])
        .filter((l) => l.assigned_to === null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    [leads.data],
  );
  const oldest = reservoir[0];

  const run = () => {
    distribute.mutate(undefined, {
      onSuccess: (r) => {
        setResult(r);
        setConfirmOpen(false);
        if (r.status === 'ok') toast.success('Lead distribuído.', { description: `${r.lead.name} para ${r.broker.name}` });
        else toast.warning(r.status === 'no_leads' ? MESSAGES.noLeads : MESSAGES.noBrokers);
      },
      onError: (e) => {
        setConfirmOpen(false);
        toast.error(e.message);
      },
    });
  };

  const highlightId = result?.status === 'ok' ? result.broker.id : null;

  return (
    <>
      <PageHeader
        title="Distribuição de leads"
        description="A roleta entrega o lead mais antigo do reservatório ao próximo corretor da fila."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Fila circular</CardTitle>
              <CardDescription>
                {overview.isLoading ? 'Carregando…' : `${eligible.length} ${eligible.length === 1 ? 'corretor habilitado' : 'corretores habilitados'}`}
              </CardDescription>
            </div>
            <Link to="/gestor/presenca" className="text-sm font-semibold text-navy-600 hover:underline">
              Presença
            </Link>
          </CardHeader>
          <CardContent>
            {overview.isLoading ? (
              <Skeleton className="mx-auto aspect-square w-full max-w-[22rem] rounded-full" />
            ) : overview.isError ? (
              <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
            ) : (
              <QueueRing brokers={eligible} highlightId={highlightId} />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted">Próximo lead (mais antigo)</p>
                  {leads.isLoading ? (
                    <Skeleton className="mt-1 h-6 w-40" />
                  ) : oldest ? (
                    <>
                      <p className="mt-0.5 font-semibold text-ink">{oldest.name}</p>
                      <p className="text-sm text-muted">
                        {originLabel(oldest.origin)}, cadastrado {formatShortDateTime(oldest.created_at)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted">Reservatório vazio</p>
                  )}
                </div>
                <div className="sm:border-l sm:border-line sm:pl-4">
                  <p className="text-xs text-muted">Próximo corretor</p>
                  {overview.isLoading ? (
                    <Skeleton className="mt-1 h-6 w-32" />
                  ) : next ? (
                    <>
                      <p className="mt-0.5 font-semibold text-ink">{next.name}</p>
                      <p className="text-sm text-muted">Posição {next.queue_rank} de {eligible.length}</p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted">Ninguém com presença válida</p>
                  )}
                </div>
              </div>

              <Button variant="accent" size="lg" className="w-full" onClick={() => setConfirmOpen(true)} loading={distribute.isPending}>
                <Shuffle aria-hidden />
                Distribuir próximo lead
              </Button>
              <p className="-mt-2 text-center text-xs text-subtle">
                {reservoir.length} {reservoir.length === 1 ? 'lead' : 'leads'} no reservatório
              </p>
            </CardContent>
          </Card>

          {result && <DistributionResultCard result={result} />}

          <Card>
            <CardHeader>
              <CardTitle>Últimas distribuições</CardTitle>
              <Link to="/gestor/historico" className="text-sm font-semibold text-navy-600 hover:underline">
                Histórico completo
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {history.isLoading ? (
                <Skeleton className="h-24" />
              ) : history.isError ? (
                <ErrorState message={history.error.message} onRetry={() => void history.refetch()} />
              ) : (history.data?.length ?? 0) === 0 ? (
                <p className="py-4 text-sm text-muted">Nenhuma distribuição registrada ainda.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {history.data?.slice(0, 5).map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-ink">{h.lead?.name ?? 'Lead removido'}</span>
                        <span className="text-muted"> para </span>
                        <span className="text-ink">{h.broker?.name ?? '—'}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular text-subtle">{formatShortDateTime(h.distributed_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Distribuir o próximo lead?"
        confirmLabel="Distribuir"
        variant="accent"
        loading={distribute.isPending}
        onConfirm={run}
      >
        <p className="text-sm leading-relaxed text-muted">
          {oldest && next ? (
            <>
              Pela fila atual, <strong className="text-ink">{oldest.name}</strong> será atribuído a{' '}
              <strong className="text-ink">{next.name}</strong>. A atribuição é confirmada pelo servidor no momento da distribuição.
            </>
          ) : (
            'O servidor vai verificar o reservatório e a fila no momento da distribuição.'
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}
