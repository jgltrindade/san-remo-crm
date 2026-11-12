import type { LeadStage } from '@/types/domain';

export interface StageMeta {
  value: LeadStage;
  label: string;
  /** cor sólida (faixa da coluna, gráfico) */
  color: string;
  /** classes do badge */
  badge: string;
}

export const STAGES: readonly StageMeta[] = [
  { value: 'new', label: 'Novo', color: 'var(--color-stage-new)', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { value: 'contacting', label: 'Em contato', color: 'var(--color-stage-contacting)', badge: 'bg-blue-50 text-blue-700 ring-blue-100' },
  { value: 'scheduled', label: 'Visita agendada', color: 'var(--color-stage-scheduled)', badge: 'bg-amber-50 text-amber-800 ring-amber-100' },
  { value: 'proposal', label: 'Proposta', color: 'var(--color-stage-proposal)', badge: 'bg-violet-50 text-violet-700 ring-violet-100' },
  { value: 'won', label: 'Ganho', color: 'var(--color-stage-won)', badge: 'bg-mata-50 text-mata-700 ring-mata-100' },
  { value: 'lost', label: 'Perdido', color: 'var(--color-stage-lost)', badge: 'bg-danger-50 text-danger-600 ring-red-100' },
] as const;

export const STAGE_BY_VALUE: Record<LeadStage, StageMeta> = Object.fromEntries(STAGES.map((s) => [s.value, s])) as Record<
  LeadStage,
  StageMeta
>;

/** Etapas consideradas "em andamento" no funil. */
export const IN_PROGRESS_STAGES: readonly LeadStage[] = ['contacting', 'scheduled', 'proposal'];

/** Origens aceitas — espelham a constraint `leads.origin` no banco. */
export const ORIGINS = [
  { value: 'site', label: 'Site' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'portal', label: 'Portal imobiliário' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'plantao', label: 'Plantão / placa' },
  { value: 'outro', label: 'Outro' },
] as const;

export type OriginValue = (typeof ORIGINS)[number]['value'];

export const ORIGIN_VALUES = ORIGINS.map((o) => o.value) as [OriginValue, ...OriginValue[]];

export function originLabel(value: string): string {
  return ORIGINS.find((o) => o.value === value)?.label ?? value;
}

export const MESSAGES = {
  noLeads: 'Não existem leads disponíveis no reservatório.',
  noBrokers: 'Não existem corretores com presença válida para receber leads.',
} as const;
