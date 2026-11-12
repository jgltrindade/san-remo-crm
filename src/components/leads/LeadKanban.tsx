import { useState, type DragEvent } from 'react';
import { STAGES } from '@/utils/constants';
import { groupByStage } from '@/utils/leads';
import { cn } from '@/utils/cn';
import type { Lead, LeadStage } from '@/types/domain';
import { LeadCard } from './LeadCard';

interface LeadKanbanProps {
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  onMove: (lead: Lead, stage: LeadStage) => void;
  showAssignee?: boolean;
}

/**
 * Kanban por etapa. Arrastar um card muda a etapa (desktop); no celular a
 * etapa é alterada pelo painel de detalhes. A permissão é validada no banco.
 */
export function LeadKanban({ leads, onOpen, onMove, showAssignee }: LeadKanbanProps) {
  const groups = groupByStage(leads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, lead: Lead) => {
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(lead.id);
  };

  const handleDrop = (e: DragEvent<HTMLElement>, stage: LeadStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const lead = leads.find((l) => l.id === id);
    setOverStage(null);
    setDraggingId(null);
    if (lead && lead.stage !== stage) onMove(lead, stage);
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <div className="grid snap-x snap-mandatory auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3">
        {STAGES.map((stage) => {
          const items = groups[stage.value];
          return (
            <section
              key={stage.value}
              aria-label={`${stage.label}: ${items.length} leads`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overStage !== stage.value) setOverStage(stage.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage(null);
              }}
              onDrop={(e) => handleDrop(e, stage.value)}
              className={cn(
                'flex min-h-[22rem] snap-start flex-col rounded-card border border-line bg-[#eef1f5] transition-colors',
                overStage === stage.value && 'border-navy-400 bg-navy-50',
              )}
            >
              <header className="flex items-center justify-between rounded-t-card border-t-[3px] px-3.5 pb-2 pt-3" style={{ borderTopColor: stage.color }}>
                <h3 className="text-[13px] font-semibold text-ink">{stage.label}</h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular text-muted">{items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2 px-2.5 pb-3">
                {items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onOpen={onOpen}
                    draggable
                    dragging={draggingId === lead.id}
                    onDragStart={handleDragStart}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                    showAssignee={showAssignee}
                  />
                ))}
                {items.length === 0 && (
                  <p className="m-1 rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-subtle">
                    Nenhum lead nesta etapa
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
