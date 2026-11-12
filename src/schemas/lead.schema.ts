import { z } from 'zod';
import { ORIGIN_VALUES } from '@/utils/constants';
import { onlyDigits } from '@/utils/format';
import type { LeadInput } from '@/types/domain';

const STAGE_VALUES = ['new', 'contacting', 'scheduled', 'proposal', 'won', 'lost'] as const;

/**
 * Validação do formulário de lead. As mesmas restrições existem no banco
 * (constraints em `leads`); aqui servem para dar feedback imediato.
 */
export const leadFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome (mínimo 2 caracteres).').max(120, 'Nome muito longo.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Informe o telefone.')
    .refine((v) => {
      const d = onlyDigits(v);
      return d.length === 10 || d.length === 11;
    }, 'Telefone deve ter DDD + número (10 ou 11 dígitos).'),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido.'),
  origin: z.enum(ORIGIN_VALUES, { errorMap: () => ({ message: 'Selecione a origem.' }) }),
  interest: z.string().trim().min(2, 'Descreva o interesse do cliente.').max(500, 'Máximo de 500 caracteres.'),
  stage: z.enum(STAGE_VALUES),
  assigned_to: z.string(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export function toLeadInput(values: LeadFormValues): LeadInput {
  return {
    name: values.name.trim(),
    phone: onlyDigits(values.phone),
    email: values.email.trim() === '' ? null : values.email.trim().toLowerCase(),
    origin: values.origin,
    interest: values.interest.trim(),
    stage: values.stage,
    assigned_to: values.assigned_to === '' ? null : values.assigned_to,
  };
}

export const noteSchema = z.object({
  content: z.string().trim().min(1, 'Escreva a observação.').max(2000, 'Máximo de 2000 caracteres.'),
});

export type NoteValues = z.infer<typeof noteSchema>;
