import { useMemo } from 'react';
import { UserRound } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { usePresenceOverview } from '@/hooks/usePresence';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IN_PROGRESS_STAGES } from '@/utils/constants';
import { formatShortDateTime, initials } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function BrokersPage() {
  const overview = usePresenceOverview();
  const leads = useLeads();

  const stats = useMemo(() => {
    const map = new Map<string, { active: number; won: number; lost: number }>();
    for (const l of leads.data ?? []) {
      if (!l.assigned_to) continue;
      const s = map.get(l.assigned_to) ?? { active: 0, won: 0, lost: 0 };
      if (IN_PROGRESS_STAGES.includes(l.stage) || l.stage === 'new') s.active += 1;
      if (l.stage === 'won') s.won += 1;
      if (l.stage === 'lost') s.lost += 1;
      map.set(l.assigned_to, s);
    }
    return map;
  }, [leads.data]);

  const brokers = [...(overview.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <>
      <PageHeader title="Corretores" description="Equipe, presença atual e desempenho nos leads atribuídos." />

      {overview.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-card" />
          ))}
        </div>
      ) : overview.isError ? (
        <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
      ) : brokers.length === 0 ? (
        <Card>
          <EmptyState icon={UserRound} title="Nenhum corretor cadastrado" description="Crie contas no Supabase Auth; elas entram como corretor automaticamente." />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brokers.map((b) => {
            const s = stats.get(b.broker_id) ?? { active: 0, won: 0, lost: 0 };
            return (
              <li key={b.broker_id}>
                <Card className="h-full p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold',
                        b.is_valid ? 'bg-mata-50 text-mata-700' : 'bg-canvas text-muted',
                      )}
                      aria-hidden
                    >
                      {initials(b.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{b.name}</p>
                      <p className="truncate text-sm text-muted">{b.email}</p>
                    </div>
                    {b.is_valid ? (
                      <Badge className="bg-mata-50 text-mata-700 ring-mata-100" dot="var(--color-mata-500)">
                        Na fila
                      </Badge>
                    ) : (
                      <Badge className="bg-canvas text-muted ring-line">Fora da fila</Badge>
                    )}
                  </div>

                  <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
                    {[
                      ['Leads', b.assigned_leads],
                      ['Ativos', s.active],
                      ['Ganhos', s.won],
                      ['Perdidos', s.lost],
                    ].map(([label, value]) => (
                      <div key={label} className="flex flex-col-reverse">
                        <dt className="text-xs text-muted">{label}</dt>
                        <dd className="text-xl font-semibold tabular text-navy-800">{leads.isLoading ? '–' : value}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-4 text-xs text-subtle">
                    {b.is_valid && b.valid_until
                      ? `Posição ${b.queue_rank} na fila, presença até ${formatShortDateTime(b.valid_until)}`
                      : b.last_checkin_at
                        ? `Última presença em ${formatShortDateTime(b.last_checkin_at)}`
                        : 'Ainda não confirmou presença'}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
