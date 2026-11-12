import { useMemo, useState } from 'react';
import { Columns3, Plus, Rows3, SearchX, Users } from 'lucide-react';
import { useBrokers, useLeads, useUpdateLeadStage } from '@/hooks/useLeads';
import { EMPTY_FILTERS, filterLeads, hasActiveFilters, type LeadFilters as Filters } from '@/utils/leads';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/utils/cn';
import type { Lead } from '@/types/domain';
import { LeadDetailsSheet } from './LeadDetailsSheet';
import { LeadFilters } from './LeadFilters';
import { LeadFormDialog } from './LeadFormDialog';
import { LeadKanban } from './LeadKanban';
import { LeadTable } from './LeadTable';

type ViewMode = 'kanban' | 'table';

const VIEW_KEY = 'sanremo.leads.view';

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'kanban';
  } catch {
    return 'kanban';
  }
}

interface LeadsWorkspaceProps {
  mode: 'manager' | 'broker';
}

/** Tela de leads compartilhada. O conjunto de leads já vem filtrado por papel pelo banco (RLS). */
export function LeadsWorkspace({ mode }: LeadsWorkspaceProps) {
  const isManager = mode === 'manager';
  const leads = useLeads();
  const brokers = useBrokers(isManager);
  const moveStage = useUpdateLeadStage();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<ViewMode>(readView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

  const filtered = useMemo(() => filterLeads(leads.data ?? [], filters), [leads.data, filters]);
  // O painel lê sempre a versão atual do cache (reflete mudanças de etapa/edição).
  const selected = useMemo(() => leads.data?.find((l) => l.id === selectedId) ?? null, [leads.data, selectedId]);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* armazenamento indisponível: preferência não persiste */
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title={isManager ? 'Leads' : 'Meus leads'}
        description={
          isManager
            ? 'Todos os contatos da imobiliária, por etapa do funil.'
            : 'Contatos atribuídos a você. Arraste os cards ou abra o lead para mudar a etapa.'
        }
        actions={
          <>
            <div className="flex rounded-lg border border-line-strong bg-surface p-0.5" role="group" aria-label="Modo de visualização">
              {(
                [
                  ['kanban', 'Kanban', Columns3],
                  ['table', 'Tabela', Rows3],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeView(value)}
                  aria-pressed={view === value}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                    view === value ? 'bg-navy-800 text-white' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {isManager && (
              <Button onClick={openCreate}>
                <Plus aria-hidden />
                Novo lead
              </Button>
            )}
          </>
        }
      />

      <LeadFilters value={filters} onChange={setFilters} brokers={isManager ? (brokers.data ?? []) : undefined} />

      <div className="mt-4">
        {leads.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="space-y-2 rounded-card border border-line bg-surface p-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ))}
          </div>
        ) : leads.isError ? (
          <ErrorState message={leads.error.message} onRetry={() => void leads.refetch()} />
        ) : (leads.data?.length ?? 0) === 0 ? (
          <div className="rounded-card border border-line bg-surface">
            <EmptyState
              icon={Users}
              title={isManager ? 'Nenhum lead cadastrado' : 'Você ainda não recebeu leads'}
              description={
                isManager
                  ? 'Cadastre o primeiro contato. Sem responsável, ele entra no reservatório da roleta.'
                  : 'Confirme sua presença pelo QR Code da recepção para entrar na fila de distribuição.'
              }
              action={isManager ? <Button onClick={openCreate}>Cadastrar lead</Button> : undefined}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-card border border-line bg-surface">
            <EmptyState
              icon={SearchX}
              title="Nenhum lead com esses filtros"
              action={
                hasActiveFilters(filters) ? (
                  <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : view === 'kanban' ? (
          <LeadKanban
            leads={filtered}
            onOpen={(l) => setSelectedId(l.id)}
            onMove={(l, stage) => moveStage.mutate({ id: l.id, stage })}
            showAssignee={isManager}
          />
        ) : (
          <LeadTable leads={filtered} onOpen={(l) => setSelectedId(l.id)} showAssignee={isManager} />
        )}
        {!leads.isLoading && filtered.length > 0 && (
          <p className="mt-3 text-xs text-subtle">
            {filtered.length} de {leads.data?.length ?? 0} leads
          </p>
        )}
      </div>

      <LeadDetailsSheet
        lead={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onEdit={
          isManager
            ? (lead) => {
                setEditing(lead);
                setFormOpen(true);
              }
            : undefined
        }
      />

      {isManager && (
        <LeadFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          lead={editing}
          onSaved={(lead) => {
            if (!editing) setSelectedId(lead.id);
          }}
        />
      )}
    </>
  );
}
