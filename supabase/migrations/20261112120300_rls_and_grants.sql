-- =============================================================================
-- San Remo CRM — 004: Row Level Security e privilégios
-- =============================================================================
-- Princípios:
--   * RLS habilitado em TODAS as tabelas públicas.
--   * Escrita em presença, tokens e histórico somente via RPC security definer.
--   * O frontend usa apenas a chave anon + JWT do usuário; nunca a service_role.
--   * `(select auth.uid())` é usado nas políticas para ser avaliado uma vez por
--     consulta (recomendação de performance do Supabase).
-- =============================================================================

alter table public.profiles             enable row level security;
alter table public.leads                enable row level security;
alter table public.lead_notes           enable row level security;
alter table public.broker_presence      enable row level security;
alter table public.qr_tokens            enable row level security;
alter table public.distribution_history enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
--   * Cada usuário vê o próprio perfil; gestores veem todos.
--   * Corretor vê também o nome de quem escreveu observações nos leads dele
--     (ex.: o gestor), para exibir o autor das observações.
--   * Ninguém altera perfis pela API (papéis só por SQL administrativo).
-- -----------------------------------------------------------------------------
create policy "profiles: leitura própria, gestor ou autor de observação"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_manager())
    or exists (
      select 1
        from public.lead_notes n
        join public.leads l on l.id = n.lead_id
       where n.user_id = profiles.id
         and l.assigned_to = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create policy "leads: gestor vê todos, corretor vê os seus"
  on public.leads for select to authenticated
  using ((select public.is_manager()) or assigned_to = (select auth.uid()));

create policy "leads: somente gestor cadastra"
  on public.leads for insert to authenticated
  with check ((select public.is_manager()));

-- Corretor atualiza apenas os próprios leads e não pode transferi-los
-- (with check). O trigger leads_guard restringe a alteração à etapa.
create policy "leads: gestor edita todos, corretor edita os seus"
  on public.leads for update to authenticated
  using ((select public.is_manager()) or assigned_to = (select auth.uid()))
  with check ((select public.is_manager()) or assigned_to = (select auth.uid()));

-- Sem política de DELETE: exclusão de leads não faz parte do escopo.

-- -----------------------------------------------------------------------------
-- lead_notes (imutáveis: sem UPDATE/DELETE)
-- -----------------------------------------------------------------------------
create policy "lead_notes: leitura conforme acesso ao lead"
  on public.lead_notes for select to authenticated
  using (
    (select public.is_manager())
    or exists (
      select 1 from public.leads l
       where l.id = lead_notes.lead_id
         and l.assigned_to = (select auth.uid())
    )
  );

create policy "lead_notes: autor é o próprio usuário e tem acesso ao lead"
  on public.lead_notes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (select public.is_manager())
      or exists (
        select 1 from public.leads l
         where l.id = lead_notes.lead_id
           and l.assigned_to = (select auth.uid())
      )
    )
  );

-- -----------------------------------------------------------------------------
-- broker_presence (escrita apenas via check_in_presence)
-- -----------------------------------------------------------------------------
create policy "broker_presence: corretor vê a sua, gestor vê todas"
  on public.broker_presence for select to authenticated
  using (broker_id = (select auth.uid()) or (select public.is_manager()));

-- -----------------------------------------------------------------------------
-- qr_tokens: nenhuma política => nenhum acesso direto pela API.
-- Acesso apenas pelas RPCs get_presence_qr / check_in_presence.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- distribution_history (escrita apenas via distribute_next_lead)
-- -----------------------------------------------------------------------------
create policy "distribution_history: gestor vê tudo, corretor vê as suas"
  on public.distribution_history for select to authenticated
  using ((select public.is_manager()) or broker_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Privilégios (defesa em profundidade além do RLS)
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.leads, public.lead_notes, public.broker_presence,
              public.qr_tokens, public.distribution_history
  from anon;

revoke insert, update, delete, truncate on public.profiles             from authenticated;
revoke update, delete, truncate         on public.lead_notes           from authenticated;
revoke delete, truncate                 on public.leads                from authenticated;
revoke insert, update, delete, truncate on public.broker_presence      from authenticated;
revoke all                              on public.qr_tokens            from authenticated;
revoke insert, update, delete, truncate on public.distribution_history from authenticated;

grant select on public.profiles, public.leads, public.lead_notes, public.broker_presence,
                public.distribution_history
  to authenticated;
grant insert, update on public.leads to authenticated;
grant insert on public.lead_notes to authenticated;

-- Funções: o Postgres concede EXECUTE a PUBLIC por padrão e o Supabase concede
-- a anon/authenticated. Restringimos explicitamente.
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.leads_guard()          from public, anon, authenticated;
revoke execute on function public.is_manager()           from public, anon;
revoke execute on function public.is_broker()            from public, anon;
revoke execute on function public.get_presence_qr()      from public, anon;
revoke execute on function public.check_in_presence(text) from public, anon;
revoke execute on function public.distribute_next_lead() from public, anon;
revoke execute on function public.get_presence_overview() from public, anon;
revoke execute on function public.get_my_presence()      from public, anon;

grant execute on function public.is_manager()            to authenticated;
grant execute on function public.is_broker()             to authenticated;
grant execute on function public.get_presence_qr()       to authenticated;
grant execute on function public.check_in_presence(text) to authenticated;
grant execute on function public.distribute_next_lead()  to authenticated;
grant execute on function public.get_presence_overview() to authenticated;
grant execute on function public.get_my_presence()       to authenticated;

revoke all on all functions in schema private from public;
revoke all on all tables    in schema private from public;
revoke all on all sequences in schema private from public;
