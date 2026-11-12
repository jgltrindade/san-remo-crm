import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquareText } from 'lucide-react';
import { useAddLeadNote, useLeadNotes } from '@/hooks/useLeads';
import { noteSchema, type NoteValues } from '@/schemas/lead.schema';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { formatDateTime, initials } from '@/utils/format';
import { cn } from '@/utils/cn';

export function LeadNotes({ leadId }: { leadId: string }) {
  const notes = useLeadNotes(leadId);
  const add = useAddLeadNote(leadId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: { content: '' } });

  const onSubmit = handleSubmit(({ content }) => add.mutate(content, { onSuccess: () => reset({ content: '' }) }));

  return (
    <section aria-labelledby="notes-title">
      <h3 id="notes-title" className="text-sm font-semibold text-ink">
        Observações
      </h3>

      <form onSubmit={onSubmit} noValidate className="mt-3">
        <Textarea
          rows={3}
          placeholder="Registre o contato, a visita ou o próximo passo…"
          aria-label="Nova observação"
          aria-invalid={Boolean(errors.content)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void onSubmit();
          }}
          {...register('content')}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={cn('text-xs', errors.content ? 'font-medium text-danger-600' : 'text-subtle')} role={errors.content ? 'alert' : undefined}>
            {errors.content?.message ?? 'Ctrl + Enter para salvar'}
          </p>
          <Button type="submit" size="sm" loading={add.isPending}>
            Adicionar observação
          </Button>
        </div>
      </form>

      <div className="mt-5">
        {notes.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : notes.isError ? (
          <ErrorState message={notes.error.message} onRetry={() => void notes.refetch()} />
        ) : notes.data && notes.data.length > 0 ? (
          <ol className="relative space-y-4 border-l border-line pl-5">
            {notes.data.map((note) => (
              <li key={note.id} className="relative">
                <span
                  className={cn(
                    'absolute -left-[2.05rem] top-0 grid size-6 place-items-center rounded-full text-[10px] font-semibold ring-4 ring-surface',
                    note.author?.role === 'manager' ? 'bg-navy-800 text-white' : 'bg-mata-50 text-mata-700',
                  )}
                  aria-hidden
                >
                  {initials(note.author?.name ?? '?')}
                </span>
                <p className="text-xs text-muted">
                  <span className="font-semibold text-ink">{note.author?.name ?? 'Usuário'}</span>
                  {note.author?.role === 'manager' && <span className="ml-1">(gestão)</span>}
                  <span className="ml-2 tabular">{formatDateTime(note.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{note.content}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-5 text-sm text-muted">
            <MessageSquareText className="size-5 text-subtle" aria-hidden />
            Nenhuma observação ainda. Registre o primeiro contato acima.
          </div>
        )}
      </div>
    </section>
  );
}
