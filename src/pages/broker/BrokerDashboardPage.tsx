import { useMemo } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useLeads } from '@/hooks/useLeads';
import { computeMetrics } from '@/utils/leads';
import { STAGE_BY_VALUE } from '@/utils/constants';
import { firstName, formatShortDateTime } from '@/utils/format';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricStrip } from '@/components/dashboard/MetricStrip';
import { PresenceStatusCard } from '@/components/presence/PresenceStatusCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { StageBadge } from '@/components/leads/StageBadge';

export default function BrokerDashboardPage() {
  const { profile } = useAuth();
  const leads = useLeads();
  const m = useMemo(() => computeMetrics(leads.data ?? []), [leads.data]);
  const fresh = (leads.data ?? []).filter((l) => l.stage === 'new').slice(0, 5);

  return (
    <>
      <PageHeader title={`Olá, ${firstName(profile?.name ?? '')}`} description="Sua presença na fila e o andamento dos seus leads." />

      <PresenceStatusCard />

      <div className="mt-6">
        {leads.isError ? (
          <ErrorState message={leads.error.message} onRetry={() => void leads.refetch()} />
        ) : (
          <MetricStrip
            loading={leads.isLoading}
            metrics={[
              { label: 'Meus leads', value: m.total },
              { label: 'Novos', value: m.byStage.find((s) => s.stage === 'new')?.count ?? 0, tone: STAGE_BY_VALUE.new.color, emphasis: true },
              { label: 'Em andamento', value: m.inProgress, tone: STAGE_BY_VALUE.contacting.color },
              { label: 'Propostas', value: m.byStage.find((s) => s.stage === 'proposal')?.count ?? 0, tone: STAGE_BY_VALUE.proposal.color },
              { label: 'Ganhos', value: m.won, tone: STAGE_BY_VALUE.won.color },
              { label: 'Perdidos', value: m.lost, tone: STAGE_BY_VALUE.lost.color },
            ]}
          />
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Leads novos para contatar</CardTitle>
          <Link to="/corretor/leads" className="text-sm font-semibold text-navy-600 hover:underline">
            Ver todos
          </Link>
        </CardHeader>
        <CardContent className="pt-3">
          {leads.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : fresh.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhum lead novo aguardando contato.</p>
          ) : (
            <ul className="divide-y divide-line">
              {fresh.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{lead.name}</p>
                    <p className="truncate text-sm text-muted">{lead.interest}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StageBadge stage={lead.stage} />
                    <span className="text-xs tabular text-subtle">{formatShortDateTime(lead.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
