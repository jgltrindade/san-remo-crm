import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Indica se as variáveis de ambiente foram configuradas (exibido na tela de login). */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Cliente único do Supabase. Usa SOMENTE a chave pública "anon": todas as
 * permissões são aplicadas no banco via RLS e RPCs com verificação de papel.
 */
export const supabase = createClient<Database>(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
