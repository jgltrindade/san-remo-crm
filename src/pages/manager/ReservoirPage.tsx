import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Inbox, Plus, Shuffle } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadDetailsSheet } from '@/components/leads/LeadDetailsSheet';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { StageBadge } from '@/components/leads/StageBadge';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { originLabel } from '@/utils/constants';
import { formatPhone, formatRelative, formatShortDateTime } from '@/utils/format';
import type { Lead } from '@/types/domain';

export default function ReservoirPage() {
  const leads = useLeads();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

  // Mesma ordem usada pela distribuição no banco: cadastro mais antigo primeiro.
  const reservoir = useMemo(
    () =>
      (leads.data ?? [])
        .filter((l) => l.assigned_to === null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    [leads.data],
  );
  const selected = leads.data?.find((l) => l.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Reservatório de leads"
        description="Leads sem responsável, na ordem em que serão distribuídos."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus aria-hidden />
              Novo lead
            </Button>
            <Link to="/gestor/distribuicao" className={buttonVariants({ variant: 'accent' })}>
              <Shuffle aria-hidden />
              Ir para a distribuição
            </Link>
          </>
        }
      />

      <Card className="overflow-hidden">
        {leads.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : leads.isError ? (
          <div className="p-5">
            <ErrorState message={leads.error.message} onRetry={() => void leads.refetch()} />
          </div>
        ) : reservoir.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Reservatório vazio"
            description="Todos os leads já têm responsável. Novos leads cadastrados sem corretor aparecem aqui."
          />
        ) : (
          <ol className="divide-y divide-line">
            {reservoir.map((lead, i) => (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-navy-50/60"
                >
                  <span
                    className={
                      i === 0
                        ? 'grid size-8 shrink-0 place-items-center rounded-full bg-mata-600 text-sm font-semibold tabular text-white'
                        : 'grid size-8 shrink-0 place-items-center rounded-full bg-canvas text-sm font-semibold tabular text-muted'
                    }
                    aria-label={`Ordem ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {lead.name}
                      {i === 0 && <span className="text-xs font-medium text-mata-700">próximo da roleta</span>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {originLabel(lead.origin)}, {lead.interest}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-sm sm:block">
                    <p className="tabular text-muted">{formatPhone(lead.phone)}</p>
                    <p className="text-xs text-subtle" title={formatShortDateTime(lead.created_at)}>
                      aguardando {formatRelative(lead.created_at).replace(/^há /, '')}
                    </p>
                  </div>
                  <StageBadge stage={lead.stage} className="hidden md:inline-flex" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <LeadDetailsSheet
        lead={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onEdit={(lead) => {
          setEditing(lead);
          setFormOpen(true);
        }}
      />
      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editing} />
    </>
  );
}
