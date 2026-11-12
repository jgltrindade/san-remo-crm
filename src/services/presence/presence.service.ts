import { supabase } from '@/services/supabase/client';
import { AppError, toAppError } from '@/services/supabase/errors';
import type { BrokerPresence, CheckInResult, MyPresence, QrToken } from '@/types/domain';
import type { Json } from '@/types/database';

type JsonObject = { [key: string]: Json | undefined };

function asObject(value: Json): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('Resposta inesperada do servidor.');
  }
  return value;
}

function str(obj: JsonObject, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string') throw new AppError('Resposta inesperada do servidor.');
  return v;
}

function strOrNull(obj: JsonObject, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' ? v : null;
}

function numOrNull(obj: JsonObject, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' ? v : null;
}

/** QR Code vigente (o servidor gera um novo somente quando o anterior expira). */
export async function getPresenceQr(): Promise<QrToken> {
  const { data, error } = await supabase.rpc('get_presence_qr');
  if (error) throw toAppError(error, 'Não foi possível gerar o QR Code.');
  const obj = asObject(data);
  return { token: str(obj, 'token'), expiresAt: str(obj, 'expires_at'), serverTime: str(obj, 'server_time') };
}

/** Confirma a presença do corretor autenticado. Toda a validação acontece no banco. */
export async function checkInPresence(token: string): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc('check_in_presence', { p_token: token });
  if (error) throw toAppError(error, 'Não foi possível confirmar sua presença.');
  const obj = asObject(data);
  const status = str(obj, 'status');

  if (status === 'ok') {
    const action = str(obj, 'action');
    if (action !== 'joined' && action !== 'renewed' && action !== 'rejoined') {
      throw new AppError('Resposta inesperada do servidor.');
    }
    return { status, action, validUntil: str(obj, 'valid_until'), lastCheckinAt: str(obj, 'last_checkin_at') };
  }
  if (status === 'not_broker' || status === 'invalid_token' || status === 'expired_token') {
    return { status };
  }
  throw new AppError('Resposta inesperada do servidor.');
}

export async function getMyPresence(): Promise<MyPresence> {
  const { data, error } = await supabase.rpc('get_my_presence');
  if (error) throw toAppError(error, 'Não foi possível carregar sua presença.');
  const obj = asObject(data);
  return {
    isValid: obj.is_valid === true,
    validUntil: strOrNull(obj, 'valid_until'),
    lastCheckinAt: strOrNull(obj, 'last_checkin_at'),
    queueRank: numOrNull(obj, 'queue_rank'),
    serviceOrder: numOrNull(obj, 'service_order'),
    queueSize: numOrNull(obj, 'queue_size') ?? 0,
  };
}

/** Visão do gestor: todos os corretores, presença e posição na fila. */
export async function getPresenceOverview(): Promise<BrokerPresence[]> {
  const { data, error } = await supabase.rpc('get_presence_overview');
  if (error) throw toAppError(error, 'Não foi possível carregar a presença dos corretores.');
  return data ?? [];
}
