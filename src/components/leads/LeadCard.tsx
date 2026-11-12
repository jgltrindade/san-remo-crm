import type { DragEvent } from 'react';
import { CalendarDays, Phone, UserRound } from 'lucide-react';
import { cn } from '@/utils/cn';
import { originLabel } from '@/utils/constants';
import { formatDate, formatPhone } from '@/utils/format';
import type { Lead } from '@/types/domain';

interface LeadCardProps {
  lead: Lead;
  onOpen: (lead: Lead) => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: DragEvent<HTMLButtonElement>, lead: Lead) => void;
  onDragEnd?: () => void;
  showAssignee?: boolean;
}

export function LeadCard({ lead, onOpen, draggable, dragging, onDragStart, onDragEnd, showAssignee = true }: LeadCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(lead)}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, lead)}
      onDragEnd={onDragEnd}
      className={cn(
        'group w-full rounded-xl border border-line bg-surface p-3.5 text-left shadow-[0_1px_2px_rgb(19_36_63/0.05)] transition hover:border-navy-200 hover:shadow-card',
        draggable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
      aria-label={`Abrir lead ${lead.name}`}
    >
      <p className="font-semibold leading-snug text-ink group-hover:text-navy-700">{lead.name}</p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{lead.interest}</p>

      <div className="mt-3 flex flex-col gap-1 text-[12px] text-muted">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 whitespace-nowrap tabular">
            <Phone className="size-3.5 text-subtle" aria-hidden />
            {formatPhone(lead.phone)}
          </span>
          <span className="truncate rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-medium">{originLabel(lead.origin)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {showAssignee ? (
            <span className={cn('flex min-w-0 items-center gap-1.5', !lead.assignee && 'text-warn-600')}>
              <UserRound className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{lead.assignee?.name ?? 'Sem responsável'}</span>
            </span>
          ) : (
            <span />
          )}
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap tabular text-subtle">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatDate(lead.created_at)}
          </span>
        </div>
      </div>
    </button>
  );
}
