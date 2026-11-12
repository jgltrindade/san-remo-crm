import { PageHeader } from '@/components/layout/PageHeader';
import { PresenceStatusCard } from '@/components/presence/PresenceStatusCard';
import { Card, CardContent } from '@/components/ui/card';

const STEPS = [
  { title: 'Leia o QR Code da recepção', text: 'Use a câmera do celular. O código muda a cada 5 minutos, então leia o que está na tela agora.' },
  { title: 'Entre com sua conta', text: 'Se já estiver logado neste celular, a confirmação é imediata.' },
  { title: 'Pronto: você está na fila', text: 'Por 5 horas você participa da roleta e recebe leads na sua vez.' },
];

export default function BrokerPresencePage() {
  return (
    <>
      <PageHeader title="Minha presença" description="Confirme presença para participar da distribuição de leads." />

      <PresenceStatusCard compact />

      <Card className="mt-6">
        <CardContent>
          <h2 className="text-[15px] font-semibold text-ink">Como confirmar</h2>
          <ol className="mt-4 grid gap-5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-50 text-sm font-semibold tabular text-navy-700">{i + 1}</span>
                <div>
                  <p className="font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-lg bg-canvas px-4 py-3 text-sm text-muted">
            Renovar com a presença ainda válida mantém sua posição. Se a presença expirar, a próxima confirmação coloca você
            no final da fila.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
