import { supabase } from '@/services/supabase/client';
import { AppError, toAppError } from '@/services/supabase/errors';
import type { DistributionRecord, DistributionResult } from '@/types/domain';
import type { Json } from '@/types/database';

type JsonObject = { [key: string]: Json | undefined };

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(obj: JsonObject, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string') throw new AppError('Resposta inesperada do servidor.');
  return v;
}

/**
 * Aciona a distribuição Round-Robin. TODA a regra (lead mais antigo, próximo
 * corretor elegível, travas, histórico e cursor) roda numa única transação no
 * banco — função `distribute_next_lead`. O frontend apenas exibe o resultado.
 */
export async function distributeNextLead(): Promise<DistributionResult> {
  const { data, error } = await supabase.rpc('distribute_next_lead');
  if (error) throw toAppError(error, 'Não foi possível distribuir o lead. Nenhuma alteração foi feita.');
  if (!isObject(data)) throw new AppError('Resposta inesperada do servidor.');

  const status = str(data, 'status');
  if (status === 'no_leads' || status === 'no_brokers') return { status };
  if (status !== 'ok') throw new AppError('Resposta inesperada do servidor.');

  const lead = data.lead;
  const broker = data.broker;
  if (!isObject(lead) || !isObject(broker) || typeof data.queue_position !== 'number') {
    throw new AppError('Resposta inesperada do servidor.');
  }

  return {
    status: 'ok',
    historyId: str(data, 'history_id'),
    distributedAt: str(data, 'distributed_at'),
    queuePosition: data.queue_position,
    lead: {
      id: str(lead, 'id'),
      name: str(lead, 'name'),
      phone: str(lead, 'phone'),
      origin: str(lead, 'origin'),
      interest: str(lead, 'interest'),
      createdAt: str(lead, 'created_at'),
    },
    broker: { id: str(broker, 'id'), name: str(broker, 'name') },
  };
}

export async function listDistributionHistory(ascending = false, limit = 200): Promise<DistributionRecord[]> {
  const { data, error } = await supabase
    .from('distribution_history')
    .select(
      'id, distributed_at, queue_position_at_distribution, lead:leads!distribution_history_lead_id_fkey(id, name), broker:profiles!distribution_history_broker_id_fkey(id, name)',
    )
    .order('distributed_at', { ascending })
    .limit(limit);
  if (error) throw toAppError(error, 'Não foi possível carregar o histórico.');
  return (data ?? []) as unknown as DistributionRecord[];
}
