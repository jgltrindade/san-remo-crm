import { originLabel } from '@/utils/constants';
import { formatDate, formatPhone } from '@/utils/format';
import type { Lead } from '@/types/domain';
import { StageBadge } from './StageBadge';

interface LeadTableProps {
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  showAssignee?: boolean;
}

export function LeadTable({ leads, onOpen, showAssignee = true }: LeadTableProps) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-canvas/60 text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Lead</th>
              <th scope="col" className="px-4 py-3 font-medium">Telefone</th>
              <th scope="col" className="px-4 py-3 font-medium">Origem</th>
              <th scope="col" className="px-4 py-3 font-medium">Etapa</th>
              {showAssignee && <th scope="col" className="px-4 py-3 font-medium">Responsável</th>}
              <th scope="col" className="px-4 py-3 text-right font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onOpen(lead)}
                className="cursor-pointer transition-colors hover:bg-navy-50/60"
              >
                <td className="max-w-[18rem] px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(lead);
                    }}
                    className="font-semibold text-ink hover:text-navy-600"
                  >
                    {lead.name}
                  </button>
                  <p className="truncate text-xs text-muted">{lead.interest}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular text-muted">{formatPhone(lead.phone)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{originLabel(lead.origin)}</td>
                <td className="px-4 py-3">
                  <StageBadge stage={lead.stage} />
                </td>
                {showAssignee && (
                  <td className="whitespace-nowrap px-4 py-3">
                    {lead.assignee ? lead.assignee.name : <span className="text-warn-600">Reservatório</span>}
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-right tabular text-muted">{formatDate(lead.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
