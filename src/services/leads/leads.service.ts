import { supabase } from '@/services/supabase/client';
import { toAppError } from '@/services/supabase/errors';
import type { Lead, LeadInput, LeadNote, LeadStage } from '@/types/domain';

const LEAD_SELECT = '*, assignee:profiles!leads_assigned_to_fkey(id, name)';

/**
 * Lista leads visíveis ao usuário. O filtro por papel acontece no banco (RLS):
 * gestor recebe todos, corretor somente os atribuídos a ele.
 */
export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from('leads').select(LEAD_SELECT).order('created_at', { ascending: false });
  if (error) throw toAppError(error, 'Não foi possível carregar os leads.');
  return (data ?? []) as unknown as Lead[];
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from('leads').select(LEAD_SELECT).eq('id', id).maybeSingle();
  if (error) throw toAppError(error, 'Não foi possível carregar o lead.');
  return data as unknown as Lead | null;
}

export async function createLead(input: LeadInput): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert(input).select(LEAD_SELECT).single();
  if (error) throw toAppError(error, 'Não foi possível cadastrar o lead.');
  return data as unknown as Lead;
}

export async function updateLead(id: string, input: LeadInput): Promise<Lead> {
  const { data, error } = await supabase.from('leads').update(input).eq('id', id).select(LEAD_SELECT).single();
  if (error) throw toAppError(error, 'Não foi possível salvar o lead.');
  return data as unknown as Lead;
}

/** Usado por gestor e corretor; o banco garante que o corretor só altera a etapa dos próprios leads. */
export async function updateLeadStage(id: string, stage: LeadStage): Promise<Lead> {
  const { data, error } = await supabase.from('leads').update({ stage }).eq('id', id).select(LEAD_SELECT).single();
  if (error) throw toAppError(error, 'Não foi possível alterar a etapa.');
  return data as unknown as Lead;
}

export async function listLeadNotes(leadId: string): Promise<LeadNote[]> {
  const { data, error } = await supabase
    .from('lead_notes')
    .select('id, lead_id, content, created_at, author:profiles!lead_notes_user_id_fkey(id, name, role)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error, 'Não foi possível carregar as observações.');
  return (data ?? []) as unknown as LeadNote[];
}

/** O autor é definido pelo banco (default auth.uid() + RLS). */
export async function addLeadNote(leadId: string, content: string): Promise<void> {
  const { error } = await supabase.from('lead_notes').insert({ lead_id: leadId, content: content.trim() });
  if (error) throw toAppError(error, 'Não foi possível registrar a observação.');
}
