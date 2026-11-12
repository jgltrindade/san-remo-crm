import { Link } from 'react-router';
import { CircleCheck, Clock, QrCode } from 'lucide-react';
import { useMyPresence } from '@/hooks/usePresence';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatRelative, formatShortDateTime, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Situação de presença do corretor autenticado. */
export function PresenceStatusCard({ compact = false }: { compact?: boolean }) {
  const presence = useMyPresence();

  if (presence.isLoading) return <Skeleton className="h-40 rounded-card" />;
  if (presence.isError) return <ErrorState message={presence.error.message} onRetry={() => void presence.refetch()} />;

  const p = presence.data;
  if (!p) return null;

  return (
    <Card className={cn('overflow-hidden', p.isValid ? 'border-mata-100' : undefined)}>
      <div className={cn('h-1.5', p.isValid ? 'bg-mata-500' : 'bg-line-strong')} aria-hidden />
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className={cn('grid size-14 shrink-0 place-items-center rounded-full', p.isValid ? 'bg-mata-50 text-mata-600' : 'bg-canvas text-subtle')}
          aria-hidden
        >
          {p.isValid ? <CircleCheck className="size-7" /> : <Clock className="size-7" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{p.isValid ? 'Presença válida' : 'Fora da fila'}</p>
          <p className="font-display text-[1.75rem] leading-tight text-navy-800">
            {p.isValid && p.validUntil ? `Até ${formatTime(p.validUntil)}` : 'Leia o QR Code da recepção'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {p.isValid && p.validUntil
              ? `Expira ${formatRelative(p.validUntil)}. Ler um novo QR Code renova por mais 5 horas sem mudar sua posição.`
              : p.lastCheckinAt
                ? `Sua última presença expirou (confirmada ${formatShortDateTime(p.lastCheckinAt)}). Ao confirmar de novo, você entra no final da fila.`
                : 'Ao confirmar presença você entra no final da fila e passa a receber leads por 5 horas.'}
          </p>
        </div>

        {p.isValid ? (
          <div className="flex shrink-0 gap-6 sm:border-l sm:border-line sm:pl-6">
            <div>
              <p className="text-xs text-muted">Posição na fila</p>
              <p className="text-2xl font-semibold tabular text-navy-800">
                {p.queueRank}
                <span className="text-sm font-medium text-subtle">/{p.queueSize}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Sua vez</p>
              <p className="text-2xl font-semibold tabular text-navy-800">
                {p.serviceOrder === 1 ? 'Próximo' : `${p.serviceOrder}º`}
              </p>
            </div>
          </div>
        ) : (
          !compact && (
            <Link to="/corretor/presenca" className="flex shrink-0 items-center gap-2 text-sm font-semibold text-navy-600 hover:underline">
              <QrCode className="size-4" aria-hidden />
              Como confirmar
            </Link>
          )
        )}
      </CardContent>
    </Card>
  );
}
