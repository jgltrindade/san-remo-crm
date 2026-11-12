import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { useBrokers, useSaveLead } from '@/hooks/useLeads';
import { leadFormSchema, toLeadInput, type LeadFormValues } from '@/schemas/lead.schema';
import { ORIGINS, STAGES } from '@/utils/constants';
import { maskPhoneInput } from '@/utils/format';
import type { Lead } from '@/types/domain';

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lead em edição; ausente = cadastro. */
  lead?: Lead | null;
  onSaved?: (lead: Lead) => void;
}

function defaults(lead?: Lead | null): LeadFormValues {
  return {
    name: lead?.name ?? '',
    phone: lead ? maskPhoneInput(lead.phone) : '',
    email: lead?.email ?? '',
    origin: (lead?.origin as LeadFormValues['origin']) ?? ('' as unknown as LeadFormValues['origin']),
    interest: lead?.interest ?? '',
    stage: lead?.stage ?? 'new',
    assigned_to: lead?.assigned_to ?? '',
  };
}

/** Cadastro/edição de lead (somente gestor; o banco recusa qualquer outro papel). */
export function LeadFormDialog({ open, onOpenChange, lead, onSaved }: LeadFormDialogProps) {
  const isEdit = Boolean(lead);
  const brokers = useBrokers(open);
  const save = useSaveLead();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<LeadFormValues>({ resolver: zodResolver(leadFormSchema), defaultValues: defaults(lead) });

  useEffect(() => {
    if (open) reset(defaults(lead));
  }, [open, lead, reset]);

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      { id: lead?.id, input: toLeadInput(values) },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  });

  const fieldProps = (name: keyof LeadFormValues) => ({
    id: `lead-${name}`,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `lead-${name}-error` : undefined,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={isEdit ? 'Editar lead' : 'Novo lead'}
      description={isEdit ? 'Atualize os dados do contato.' : 'Sem responsável, o lead vai para o reservatório e entra na roleta.'}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="lead-form" loading={save.isPending} disabled={isEdit && !isDirty}>
            {isEdit ? 'Salvar alterações' : 'Cadastrar lead'}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="lead-name" error={errors.name?.message} className="sm:col-span-2">
          <Input {...fieldProps('name')} autoComplete="off" {...register('name')} />
        </Field>

        <Field label="Telefone" htmlFor="lead-phone" error={errors.phone?.message}>
          <Input
            {...fieldProps('phone')}
            inputMode="tel"
            placeholder="(48) 99999-9999"
            {...register('phone', {
              onChange: (e: { target: { value: string } }) =>
                setValue('phone', maskPhoneInput(e.target.value), { shouldDirty: true }),
            })}
          />
        </Field>

        <Field label="E-mail" htmlFor="lead-email" error={errors.email?.message} optional>
          <Input {...fieldProps('email')} type="email" inputMode="email" {...register('email')} />
        </Field>

        <Field label="Origem" htmlFor="lead-origin" error={errors.origin?.message}>
          <Select {...fieldProps('origin')} {...register('origin')}>
            <option value="" disabled>
              Selecione
            </option>
            {ORIGINS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Etapa" htmlFor="lead-stage" error={errors.stage?.message}>
          <Select {...fieldProps('stage')} {...register('stage')}>
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Interesse imobiliário"
          htmlFor="lead-interest"
          error={errors.interest?.message}
          hint="Tipo de imóvel, bairro, faixa de valor, finalidade."
          className="sm:col-span-2"
        >
          <Textarea {...fieldProps('interest')} rows={3} {...register('interest')} />
        </Field>

        <Field
          label="Corretor responsável"
          htmlFor="lead-assigned_to"
          optional
          hint={brokers.isError ? 'Não foi possível carregar os corretores.' : 'Deixe em branco para enviar ao reservatório.'}
          className="sm:col-span-2"
        >
          <Select {...fieldProps('assigned_to')} {...register('assigned_to')}>
            <option value="">Sem responsável (reservatório)</option>
            {/* Garante que o responsável atual exista como opção antes da lista carregar. */}
            {lead?.assignee && !brokers.data?.some((b) => b.id === lead.assignee?.id) && (
              <option value={lead.assignee.id}>{lead.assignee.name}</option>
            )}
            {brokers.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}
