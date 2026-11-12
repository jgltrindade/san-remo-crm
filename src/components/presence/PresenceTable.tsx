import { UserRound } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { formatRelative, formatShortDateTime } from '@/utils/format';
import type { BrokerPresence } from '@/types/domain';

function Row({ b }: { b: BrokerPresence }) {
  return (
    <tr className={b.is_valid ? undefined : 'text-muted'}>
      <td className="whitespace-nowrap px-4 py-3">
        {b.is_valid ? (
          <span className="grid size-7 place-items-center rounded-full bg-navy-800 text-xs font-semibold tabular text-white">{b.queue_rank}</span>
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-canvas text-xs text-subtle" aria-label="Fora da fila">
            —
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-ink">{b.name}</p>
        <p className="text-xs text-muted">{b.email}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {b.is_valid ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="bg-mata-50 text-mata-700 ring-mata-100" dot="var(--color-mata-500)">
              Habilitado
            </Badge>
            {b.is_next && <Badge className="bg-navy-800 text-white ring-navy-800">Próximo a receber</Badge>}
          </div>
        ) : b.last_checkin_at ? (
          <Badge className="bg-danger-50 text-danger-600 ring-red-100">Presença expirada</Badge>
        ) : (
          <Badge className="bg-canvas text-muted ring-line">Sem presença</Badge>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 tabular">{b.last_checkin_at ? formatShortDateTime(b.last_checkin_at) : '—'}</td>
      <td className="whitespace-nowrap px-4 py-3 tabular">
        {b.valid_until ? (
          <>
            {formatShortDateTime(b.valid_until)}
            <span className="block text-xs text-subtle">{formatRelative(b.valid_until)}</span>
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular">{b.assigned_leads}</td>
    </tr>
  );
}

export function PresenceTable({ brokers }: { brokers: BrokerPresence[] }) {
  if (brokers.length === 0) {
    return <EmptyState icon={UserRound} title="Nenhum corretor cadastrado" description="Crie contas de corretor no Supabase Auth (veja o README)." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Posição</th>
            <th scope="col" className="px-4 py-3 font-medium">Corretor</th>
            <th scope="col" className="px-4 py-3 font-medium">Situação</th>
            <th scope="col" className="px-4 py-3 font-medium">Última confirmação</th>
            <th scope="col" className="px-4 py-3 font-medium">Expiração</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Leads</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {brokers.map((b) => (
            <Row key={b.broker_id} b={b} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
