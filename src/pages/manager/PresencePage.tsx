import { Link } from 'react-router';
import { Expand } from 'lucide-react';
import { usePresenceOverview } from '@/hooks/usePresence';
import { PageHeader } from '@/components/layout/PageHeader';
import { PresenceQrPanel } from '@/components/presence/PresenceQrPanel';
import { PresenceTable } from '@/components/presence/PresenceTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { buttonVariants } from '@/components/ui/button';

export default function PresencePage() {
  const overview = usePresenceOverview();
  const valid = overview.data?.filter((b) => b.is_valid).length ?? 0;
  const expired = overview.data?.filter((b) => !b.is_valid && b.last_checkin_at).length ?? 0;

  return (
    <>
      <PageHeader
        title="Presença dos corretores"
        description="O QR Code muda a cada 5 minutos. A leitura confirma a presença por 5 horas."
        actions={
          <Link to="/gestor/qrcode" target="_blank" className={buttonVariants({ variant: 'outline' })}>
            <Expand aria-hidden />
            Abrir em tela cheia
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader>
            <div>
              <CardTitle>QR Code vigente</CardTitle>
              <CardDescription>Exiba na recepção. Só o código atual é aceito.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PresenceQrPanel size={232} />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>Fila de corretores</CardTitle>
              <CardDescription>
                {overview.isLoading
                  ? 'Carregando…'
                  : `${valid} ${valid === 1 ? 'habilitado' : 'habilitados'}, ${expired} com presença expirada`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-1 pb-2 pt-3">
            {overview.isLoading ? (
              <div className="space-y-2 px-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : overview.isError ? (
              <div className="px-4">
                <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
              </div>
            ) : (
              <PresenceTable brokers={overview.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-subtle">
        A posição é a ordem fixa da fila circular. Quem confirma presença pela primeira vez, ou volta depois de expirar,
        entra no final. Renovar uma presença ainda válida mantém a posição.
      </p>
    </>
  );
}
