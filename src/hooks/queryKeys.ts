export const queryKeys = {
  leads: ['leads'] as const,
  leadNotes: (leadId: string) => ['leads', leadId, 'notes'] as const,
  brokers: ['brokers'] as const,
  presenceOverview: ['presence', 'overview'] as const,
  myPresence: ['presence', 'me'] as const,
  presenceQr: ['presence', 'qr'] as const,
  history: (ascending: boolean) => ['distribution', 'history', ascending] as const,
};
