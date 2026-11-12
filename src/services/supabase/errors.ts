interface PostgrestLikeError {
  message?: string;
  code?: string;
}

function isPostgrestLikeError(value: unknown): value is PostgrestLikeError {
  return typeof value === 'object' && value !== null && ('message' in value || 'code' in value);
}

/** Erro de aplicação com mensagem pronta para o usuário. */
export class AppError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/**
 * Converte erros do Supabase/Postgres em mensagens amigáveis.
 * Mensagens lançadas pelas nossas funções SQL (raise exception) já estão em
 * português e são preservadas.
 */
export function toAppError(error: unknown, fallback = 'Não foi possível concluir a operação. Tente novamente.'): AppError {
  if (error instanceof AppError) return error;
  if (!isPostgrestLikeError(error)) return new AppError(fallback);

  const { code, message = '' } = error;

  if (code === '42501') {
    // Mensagens nativas do Postgres (RLS/privilégio) vêm em inglês; as nossas, em português.
    const isNative = /^(new row violates|permission denied)/i.test(message);
    return new AppError(isNative || !message ? 'Você não tem permissão para esta ação.' : message, code);
  }
  if (code === '23514') {
    return new AppError(message.includes('corretor') ? message : 'Alguns dados não passaram na validação do servidor.', code);
  }
  if (code === '40001') return new AppError(message || 'A operação conflitou com outra. Tente novamente.', code);
  if (code === 'PGRST301' || code === '28000') return new AppError('Sua sessão expirou. Entre novamente.', code);
  if (message.toLowerCase().includes('failed to fetch')) {
    return new AppError('Sem conexão com o servidor. Verifique sua internet.', code);
  }
  return new AppError(fallback, code);
}
