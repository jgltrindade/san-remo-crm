import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCountdown, usePresenceQr } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatCountdown } from '@/utils/format';
import { cn } from '@/utils/cn';
import { buildCheckInUrl } from '@/utils/presence';

const TOKEN_LIFETIME_MS = 5 * 60 * 1000;

interface PresenceQrPanelProps {
  size?: number;
  variant?: 'card' | 'display';
}

/**
 * QR Code vigente com contador regressivo. A renovação é automática: quando o
 * contador zera, o hook busca o novo token no servidor (sem recarregar a página).
 */
export function PresenceQrPanel({ size = 248, variant = 'card' }: PresenceQrPanelProps) {
  const qr = usePresenceQr();
  const remaining = useCountdown(qr.data?.expiresAt, qr.data?.clockOffset);
  const renewing = qr.isFetching && (remaining === null || remaining <= 1000);
  const display = variant === 'display';

  if (qr.isLoading) {
    return <Skeleton className="aspect-square w-full max-w-[18rem] rounded-2xl" />;
  }
  if (qr.isError || !qr.data) {
    return <ErrorState message={qr.error?.message ?? 'Não foi possível gerar o QR Code.'} onRetry={() => void qr.refetch()} />;
  }

  const url = buildCheckInUrl(qr.data.token);
  const progress = remaining === null ? 0 : Math.min(1, remaining / TOKEN_LIFETIME_MS);
  const ending = remaining !== null && remaining < 30_000;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link de presença copiado.', { description: 'Válido somente enquanto este QR Code estiver vigente.' });
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className={cn('relative rounded-2xl bg-white p-4 ring-1 ring-line', display && 'p-6 shadow-lift')}>
        <QRCodeSVG
          key={qr.data.token}
          value={url}
          size={size}
          level="M"
          fgColor="#13243F"
          bgColor="#FFFFFF"
          className={cn('animate-pop transition-opacity', renewing && 'opacity-20')}
          role="img"
          aria-label="QR Code de confirmação de presença"
        />
        {renewing && (
          <div className="absolute inset-0 grid place-items-center" role="status">
            <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-navy-700 shadow-card">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Gerando novo código
            </span>
          </div>
        )}
      </div>

      <div className={cn('mt-5 w-full', display ? 'max-w-md' : 'max-w-[18rem]')}>
        <div className="flex items-baseline justify-between">
          <span className={cn('text-muted', display ? 'text-lg' : 'text-sm')}>Renova em</span>
          <span
            className={cn('font-semibold tabular', display ? 'text-4xl' : 'text-2xl', ending ? 'text-warn-600' : 'text-navy-800')}
            aria-live="off"
          >
            {remaining === null ? '—' : formatCountdown(remaining)}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-50"
          role="progressbar"
          aria-label="Tempo restante do QR Code"
          aria-valuemin={0}
          aria-valuemax={300}
          aria-valuenow={remaining === null ? 0 : Math.round(remaining / 1000)}
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-300 ease-linear', ending ? 'bg-warn-600' : 'bg-mata-500')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {!display && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            <Copy aria-hidden />
            Copiar link
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void qr.refetch()} disabled={qr.isFetching}>
            <RefreshCw aria-hidden className={qr.isFetching ? 'animate-spin' : undefined} />
            Atualizar
          </Button>
        </div>
      )}
    </div>
  );
}
