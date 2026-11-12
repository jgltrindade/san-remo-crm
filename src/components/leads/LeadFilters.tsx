import { Search, X } from 'lucide-react';
import { Input, Select } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { ORIGINS, STAGES } from '@/utils/constants';
import { EMPTY_FILTERS, hasActiveFilters, type LeadFilters as Filters } from '@/utils/leads';
import type { LeadStage, Profile } from '@/types/domain';

interface LeadFiltersProps {
  value: Filters;
  onChange: (value: Filters) => void;
  brokers?: Profile[];
  /** Esconde o filtro de etapa (ex.: na visão Kanban, onde as colunas já separam). */
  hideStage?: boolean;
}

export function LeadFilters({ value, onChange, brokers, hideStage }: LeadFiltersProps) {
  const set = <K extends keyof Filters>(key: K, v: Filters[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3 shadow-card lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-[1.4]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input
          aria-label="Buscar por nome"
          placeholder="Buscar por nome"
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          className="pl-9"
        />
      </div>
      <Input
        aria-label="Buscar por telefone"
        placeholder="Telefone"
        inputMode="tel"
        value={value.phone}
        onChange={(e) => set('phone', e.target.value)}
        className="lg:max-w-40"
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:flex lg:flex-[2]">
        {!hideStage && (
          <Select aria-label="Filtrar por etapa" value={value.stage} onChange={(e) => set('stage', e.target.value as LeadStage | '')}>
            <option value="">Todas as etapas</option>
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Filtrar por origem" value={value.origin} onChange={(e) => set('origin', e.target.value)}>
          <option value="">Todas as origens</option>
          {ORIGINS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {brokers && (
          <Select aria-label="Filtrar por corretor" value={value.assignee} onChange={(e) => set('assignee', e.target.value)}>
            <option value="">Todos os corretores</option>
            <option value="none">Sem responsável</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {hasActiveFilters(value) && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)} className="self-start lg:self-center">
          <X aria-hidden />
          Limpar
        </Button>
      )}
    </div>
  );
}
