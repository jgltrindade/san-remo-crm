import type { ReactNode } from 'react';
import { CalendarDays, Mail, Pencil, Phone, RefreshCw, UserRound, X } from 'lucide-react';
import { Sheet, SheetClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUpdateLeadStage } from '@/hooks/useLeads';
import { STAGES, originLabel } from '@/utils/constants';
import { formatDateTime, formatPhone, onlyDigits } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { Lead } from '@/types/domain';
import { LeadNotes } from './LeadNotes';
import { StageBadge } from './StageBadge';

interface LeadDetailsSheetProps {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
  /** Disponível apenas ao gestor. */
  onEdit?: (lead: Lead) => void;
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <div className="text-sm text-ink">{children}</div>
      </div>
    </div>
  );
}

export function LeadDetailsSheet({ lead, onOpenChange, onEdit }: LeadDetailsSheetProps) {
  const updateStage = useUpdateLeadStage();

  return (
    <Sheet open={Boolean(lead)} onOpenChange={onOpenChange} title={lead ? `Lead ${lead.name}` : 'Lead'}>
      {lead && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={lead.stage} />
                <span className="text-xs text-muted">{originLabel(lead.origin)}</span>
              </div>
              <h2 className="mt-2 font-display text-[1.875rem] leading-tight text-navy-800">{lead.name}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(lead)}>
                  <Pencil aria-hidden />
                  Editar
                </Button>
              )}
              <SheetClose className="rounded-md p-2 text-subtle hover:bg-navy-50 hover:text-ink" aria-label="Fechar">
                <X className="size-4" />
              </SheetClose>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <section aria-label="Etapa do funil">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Etapa</h3>
                {updateStage.isPending && <RefreshCw className="size-3.5 animate-spin text-subtle" aria-label="Salvando" />}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Alterar etapa">
                {STAGES.map((s) => {
                  const active = lead.stage === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={updateStage.isPending}
                      onClick={() => !active && updateStage.mutate({ id: lead.id, stage: s.value })}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors disabled:opacity-60',
                        active ? 'border-transparent text-white' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                      )}
                      style={active ? { background: s.color } : undefined}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ background: active ? 'white' : s.color }} aria-hidden />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-label="Dados do lead" className="mt-6 divide-y divide-line rounded-xl border border-line px-4">
              <InfoRow icon={Phone} label="Telefone">
                <a href={`tel:+55${onlyDigits(lead.phone).slice(-11)}`} className="tabular hover:text-navy-600 hover:underline">
                  {formatPhone(lead.phone)}
                </a>
                <a
                  href={`https://wa.me/55${onlyDigits(lead.phone).slice(-11)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 text-xs font-semibold text-mata-600 hover:underline"
                >
                  WhatsApp
                </a>
              </InfoRow>
              <InfoRow icon={Mail} label="E-mail">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="break-all hover:text-navy-600 hover:underline">
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-subtle">Não informado</span>
                )}
              </InfoRow>
              <InfoRow icon={UserRound} label="Corretor responsável">
                {lead.assignee?.name ?? <span className="text-warn-600">Sem responsável (reservatório)</span>}
              </InfoRow>
              <InfoRow icon={CalendarDays} label="Cadastro e última atualização">
                <span className="tabular">{formatDateTime(lead.created_at)}</span>
                <span className="block text-xs tabular text-muted">Atualizado em {formatDateTime(lead.updated_at)}</span>
              </InfoRow>
            </section>

            <section aria-label="Interesse" className="mt-6">
              <h3 className="text-sm font-semibold text-ink">Interesse imobiliário</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{lead.interest}</p>
            </section>

            <div className="mt-8">
              <LeadNotes leadId={lead.id} />
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
