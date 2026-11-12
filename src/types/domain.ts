import type { Database, LeadStage, UserRole } from './database';

export type { LeadStage, UserRole };

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type LeadRow = Database['public']['Tables']['leads']['Row'];

export interface PersonRef {
  id: string;
  name: string;
}

export interface Lead extends LeadRow {
  assignee: PersonRef | null;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_at: string;
  author: (PersonRef & { role: UserRole }) | null;
}

export interface LeadInput {
  name: string;
  phone: string;
  email: string | null;
  origin: string;
  interest: string;
  stage: LeadStage;
  assigned_to: string | null;
}

export interface QrToken {
  token: string;
  expiresAt: string;
  serverTime: string;
}

export type CheckInResult =
  | { status: 'ok'; action: 'joined' | 'renewed' | 'rejoined'; validUntil: string; lastCheckinAt: string }
  | { status: 'not_broker' | 'invalid_token' | 'expired_token' };

export interface MyPresence {
  isValid: boolean;
  validUntil: string | null;
  lastCheckinAt: string | null;
  queueRank: number | null;
  serviceOrder: number | null;
  queueSize: number;
}

export type BrokerPresence = Database['public']['Functions']['get_presence_overview']['Returns'][number];

export interface DistributionSuccess {
  status: 'ok';
  historyId: string;
  distributedAt: string;
  queuePosition: number;
  lead: { id: string; name: string; phone: string; origin: string; interest: string; createdAt: string };
  broker: PersonRef;
}

export type DistributionResult = DistributionSuccess | { status: 'no_leads' | 'no_brokers' };

export interface DistributionRecord {
  id: string;
  distributed_at: string;
  queue_position_at_distribution: number;
  lead: { id: string; name: string } | null;
  broker: PersonRef | null;
}
