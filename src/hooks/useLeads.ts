import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addLeadNote,
  createLead,
  listLeadNotes,
  listLeads,
  updateLead,
  updateLeadStage,
} from '@/services/leads/leads.service';
import { listBrokers } from '@/services/profiles/profiles.service';
import { STAGE_BY_VALUE } from '@/utils/constants';
import type { Lead, LeadInput, LeadStage } from '@/types/domain';
import { queryKeys } from './queryKeys';

export function useLeads() {
  return useQuery({ queryKey: queryKeys.leads, queryFn: listLeads });
}

export function useBrokers(enabled = true) {
  return useQuery({ queryKey: queryKeys.brokers, queryFn: listBrokers, enabled, staleTime: 5 * 60_000 });
}

export function useLeadNotes(leadId: string | null) {
  return useQuery({
    queryKey: queryKeys.leadNotes(leadId ?? 'none'),
    queryFn: () => listLeadNotes(leadId as string),
    enabled: Boolean(leadId),
  });
}

function replaceLead(list: Lead[] | undefined, lead: Lead): Lead[] | undefined {
  return list?.map((l) => (l.id === lead.id ? lead : l));
}

export function useSaveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LeadInput }) => (id ? updateLead(id, input) : createLead(input)),
    onSuccess: (lead, { id }) => {
      toast.success(id ? 'Lead atualizado.' : 'Lead cadastrado.', { description: lead.name });
      void qc.invalidateQueries({ queryKey: queryKeys.leads });
      void qc.invalidateQueries({ queryKey: queryKeys.presenceOverview });
    },
  });
}

/** Alteração de etapa com atualização otimista (Kanban responde na hora). */
export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) => updateLeadStage(id, stage),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: queryKeys.leads });
      const previous = qc.getQueryData<Lead[]>(queryKeys.leads);
      qc.setQueryData<Lead[]>(queryKeys.leads, (list) => list?.map((l) => (l.id === id ? { ...l, stage } : l)));
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.leads, ctx.previous);
      toast.error(error.message);
    },
    onSuccess: (lead) => {
      qc.setQueryData<Lead[]>(queryKeys.leads, (list) => replaceLead(list, lead));
      toast.success(`Etapa alterada para "${STAGE_BY_VALUE[lead.stage].label}".`, { description: lead.name });
    },
  });
}

export function useAddLeadNote(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => addLeadNote(leadId, content),
    onSuccess: () => {
      toast.success('Observação registrada.');
      void qc.invalidateQueries({ queryKey: queryKeys.leadNotes(leadId) });
    },
    onError: (error) => toast.error(error.message),
  });
}
