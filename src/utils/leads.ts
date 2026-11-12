import type { Lead, LeadStage } from '@/types/domain';
import { IN_PROGRESS_STAGES, ORIGINS, STAGES } from './constants';
import { onlyDigits } from './format';

export interface LeadFilters {
  name: string;
  phone: string;
  stage: LeadStage | '';
  origin: string;
  /** id do corretor, 'none' para sem responsável, '' para todos */
  assignee: string;
}

export const EMPTY_FILTERS: LeadFilters = { name: '', phone: '', stage: '', origin: '', assignee: '' };

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function filterLeads(leads: Lead[], f: LeadFilters): Lead[] {
  const name = normalize(f.name);
  const phone = onlyDigits(f.phone);
  return leads.filter((l) => {
    if (name && !normalize(l.name).includes(name)) return false;
    if (phone && !l.phone.includes(phone)) return false;
    if (f.stage && l.stage !== f.stage) return false;
    if (f.origin && l.origin !== f.origin) return false;
    if (f.assignee === 'none' && l.assigned_to !== null) return false;
    if (f.assignee && f.assignee !== 'none' && l.assigned_to !== f.assignee) return false;
    return true;
  });
}

export function hasActiveFilters(f: LeadFilters): boolean {
  return Object.values(f).some((v) => v !== '');
}

export function groupByStage(leads: Lead[]): Record<LeadStage, Lead[]> {
  const groups = Object.fromEntries(STAGES.map((s) => [s.value, [] as Lead[]])) as Record<LeadStage, Lead[]>;
  for (const lead of leads) groups[lead.stage].push(lead);
  return groups;
}

export interface LeadMetrics {
  total: number;
  reservoir: number;
  distributed: number;
  inProgress: number;
  won: number;
  lost: number;
  conversionRate: number | null;
  byStage: { stage: LeadStage; label: string; color: string; count: number }[];
  byOrigin: { origin: string; label: string; count: number }[];
}

/** Indicadores do dashboard, calculados sobre os leads visíveis ao usuário (RLS). */
export function computeMetrics(leads: Lead[]): LeadMetrics {
  const count = (pred: (l: Lead) => boolean) => leads.filter(pred).length;
  const won = count((l) => l.stage === 'won');
  const lost = count((l) => l.stage === 'lost');
  const closed = won + lost;

  return {
    total: leads.length,
    reservoir: count((l) => l.assigned_to === null),
    distributed: count((l) => l.assigned_to !== null),
    inProgress: count((l) => IN_PROGRESS_STAGES.includes(l.stage)),
    won,
    lost,
    conversionRate: closed > 0 ? won / closed : null,
    byStage: STAGES.map((s) => ({ stage: s.value, label: s.label, color: s.color, count: count((l) => l.stage === s.value) })),
    byOrigin: ORIGINS.map((o) => ({ origin: o.value, label: o.label, count: count((l) => l.origin === o.value) }))
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count),
  };
}
