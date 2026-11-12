import { supabase } from '@/services/supabase/client';
import { toAppError } from '@/services/supabase/errors';
import type { Profile } from '@/types/domain';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw toAppError(error, 'Não foi possível carregar seu perfil.');
  return data;
}

/** Lista de corretores (somente gestores enxergam todos, via RLS). */
export async function listBrokers(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').eq('role', 'broker').order('name');
  if (error) throw toAppError(error, 'Não foi possível carregar os corretores.');
  return data ?? [];
}
