-- =============================================================================
-- San Remo CRM — 001: esquema principal (perfis, leads, observações)
-- =============================================================================
-- Convenções:
--   * Todas as funções usam `set search_path = ''` e nomes totalmente
--     qualificados (proteção contra search_path hijacking).
--   * Regras de negócio críticas vivem no banco (triggers, RLS e RPCs).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schema privado: não é exposto pela API REST do Supabase (PostgREST expõe
-- apenas `public` e `graphql_public`). Guarda segredos, sequência e cursor.
create schema if not exists private;
revoke all on schema private from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema private from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema private from authenticated';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('manager', 'broker');

create type public.lead_stage as enum (
  'new',         -- Novo
  'contacting',  -- Em contato
  'scheduled',   -- Visita agendada
  'proposal',    -- Proposta
  'won',         -- Ganho
  'lost'         -- Perdido
);

-- -----------------------------------------------------------------------------
-- profiles: dados complementares de auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  email       text not null,
  role        public.user_role not null default 'broker',
  created_at  timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

comment on table public.profiles is 'Perfil de cada usuário autenticado. O papel (role) só pode ser alterado por SQL administrativo.';

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 120),
  -- telefone armazenado somente com dígitos (DDD + número, opcionalmente DDI)
  phone        text not null check (phone ~ '^[0-9]{10,13}$'),
  email        text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  origin       text not null check (origin in (
                 'site', 'instagram', 'facebook', 'google_ads', 'portal',
                 'indicacao', 'whatsapp', 'plantao', 'outro')),
  interest     text not null check (char_length(btrim(interest)) between 2 and 500),
  stage        public.lead_stage not null default 'new',
  assigned_to  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Reservatório: leads sem responsável, do mais antigo para o mais novo.
-- Índice parcial usado diretamente pela distribuição.
create index leads_reservoir_idx on public.leads (created_at, id) where assigned_to is null;
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_stage_idx on public.leads (stage);

comment on column public.leads.assigned_to is 'Corretor responsável. NULL = lead no reservatório do gestor.';

-- -----------------------------------------------------------------------------
-- lead_notes: observações (imutáveis) de um lead
-- -----------------------------------------------------------------------------
create table public.lead_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  content     text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);
create index lead_notes_user_idx on public.lead_notes (user_id);

-- -----------------------------------------------------------------------------
-- Funções auxiliares de papel (usadas pelas políticas RLS)
-- security definer: leem profiles sem disparar RLS (evita recursão).
-- -----------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager'
  );
$$;

create or replace function public.is_broker()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'broker'
  );
$$;

-- -----------------------------------------------------------------------------
-- Criação automática do perfil ao cadastrar usuário no Supabase Auth.
-- SEGURANÇA: o papel é SEMPRE 'broker'. Metadados enviados no cadastro são
-- controlados pelo cliente e nunca devem definir permissões. A promoção a
-- gestor é feita por SQL administrativo (ver README / seed.sql).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'broker'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Guarda de integridade dos leads (INSERT/UPDATE)
--   * O responsável, quando informado, precisa ser um corretor.
--   * created_at é imutável; updated_at é mantido pelo banco.
--   * Usuário autenticado que não é gestor (corretor) só pode alterar a ETAPA
--     dos próprios leads — nunca o responsável nem os dados cadastrais.
--     (A RLS garante que ele só enxerga/atualiza os próprios leads.)
--   * Execuções sem usuário (migrations, seed, service_role) não são afetadas.
-- -----------------------------------------------------------------------------
create or replace function public.leads_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (
       select 1 from public.profiles p
       where p.id = new.assigned_to and p.role = 'broker'
     ) then
    raise exception 'O responsável pelo lead precisa ser um corretor.'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.updated_at := new.created_at;
    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();

  if v_uid is not null and not public.is_manager() then
    if new.assigned_to is distinct from old.assigned_to
       or new.name     is distinct from old.name
       or new.phone    is distinct from old.phone
       or new.email    is distinct from old.email
       or new.origin   is distinct from old.origin
       or new.interest is distinct from old.interest then
      raise exception 'Corretores só podem alterar a etapa dos próprios leads.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger leads_guard
  before insert or update on public.leads
  for each row execute function public.leads_guard();
