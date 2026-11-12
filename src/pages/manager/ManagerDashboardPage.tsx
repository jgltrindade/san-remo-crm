import { useMemo } from 'react';
import { Link } from 'react-router';
import { Inbox, QrCode, Shuffle } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { usePresenceOverview } from '@/hooks/usePresence';
import { useAuth } from '@/hooks/useAuth';
import { computeMetrics } from '@/utils/leads';
import { firstName } from '@/utils/format';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricStrip } from '@/components/dashboard/MetricStrip';
import { OriginChart, StageFunnelChart } from '@/components/dashboard/Charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { buttonVariants } from '@/components/ui/button';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function ManagerDashboardPage() {
  const { profile } = useAuth();
  const leads = useLeads();
  const presence = usePresenceOverview();
  const m = useMemo(() => computeMetrics(leads.data ?? []), [leads.data]);

  const present = presence.data?.filter((b) => b.is_valid) ?? [];
  const next = presence.data?.find((b) => b.is_next);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName(profile?.name ?? '')}`}
        description="Visão geral do funil e da fila de distribuição."
        actions={
          <Link to="/gestor/distribuicao" className={buttonVariants({ variant: 'accent' })}>
            <Shuffle aria-hidden />
            Distribuir leads
          </Link>
        }
      />

      {leads.isError ? (
        <ErrorState message={leads.error.message} onRetry={() => void leads.refetch()} />
      ) : (
        <MetricStrip
          loading={leads.isLoading}
          metrics={[
            { label: 'Total de leads', value: m.total },
            { label: 'No reservatório', value: m.reservoir, tone: 'var(--color-warn-600)', hint: 'aguardando a roleta', emphasis: m.reservoir > 0 },
            { label: 'Distribuídos', value: m.distributed, tone: 'var(--color-navy-600)' },
            { label: 'Em andamento', value: m.inProgress, tone: 'var(--color-stage-contacting)', hint: 'contato, visita ou proposta' },
            { label: 'Ganhos', value: m.won, tone: 'var(--color-stage-won)', hint: m.conversionRate !== null ? `${Math.round(m.conversionRate * 100)}% dos fechados` : undefined },
            { label: 'Perdidos', value: m.lost, tone: 'var(--color-stage-lost)' },
          ]}
        />
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Funil por etapa</CardTitle>
              <CardDescription>Quantidade de leads em cada etapa.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{leads.isLoading ? <Skeleton className="h-64" /> : <StageFunnelChart data={m.byStage} />}</CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="bg-navy-800 text-white">
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-navy-200">Fila de distribuição agora</p>
                  {presence.isLoading ? (
                    <Skeleton className="mt-2 h-8 w-40 bg-white/10" />
                  ) : (
                    <p className="mt-1 font-display text-[1.875rem] leading-tight">
                      {present.length === 0
                        ? 'Ninguém na fila'
                        : `${present.length} ${present.length === 1 ? 'corretor presente' : 'corretores presentes'}`}
                    </p>
                  )}
                </div>
                <QrCode className="size-6 text-navy-200" aria-hidden />
              </div>
              <p className="text-sm text-navy-200">
                {next ? (
                  <>
                    Próximo a receber: <strong className="font-semibold text-white">{next.name}</strong>
                  </>
                ) : (
                  'Exiba o QR Code na recepção para os corretores confirmarem presença.'
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/gestor/presenca" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'border-white/20 bg-white/5 text-white hover:bg-white/10' })}>
                  Ver presença
                </Link>
                {m.reservoir > 0 && (
                  <Link to="/gestor/reservatorio" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-navy-100 hover:bg-white/10 hover:text-white' })}>
                    <Inbox aria-hidden />
                    {m.reservoir} no reservatório
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <div>
                <CardTitle>Origem dos leads</CardTitle>
                <CardDescription>De onde vêm os contatos.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {leads.isLoading ? (
                <Skeleton className="h-64" />
              ) : m.byOrigin.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">Sem leads cadastrados.</p>
              ) : (
                <OriginChart data={m.byOrigin} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
