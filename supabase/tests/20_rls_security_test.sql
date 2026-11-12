-- =============================================================================
-- Testes: Row Level Security, privilégios e integridade de permissões
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create schema if not exists tests;
create or replace function tests.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;

-- Tentativa de escalar privilégio via metadados do cadastro: deve virar broker.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestora@example.com', '{"name":"Gestora"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'joao@example.com',    '{"name":"João", "role":"manager"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'maria@example.com',   '{"name":"Maria"}');
update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000a1';

\echo '[auth] metadados de cadastro não concedem papel de gestor'
do $$ begin
  assert (select role from public.profiles where email = 'joao@example.com') = 'broker';
end $$;

insert into public.leads (id, name, phone, origin, interest, assigned_to) values
  ('10000000-0000-0000-0000-000000000001', 'Lead do João',  '48988887777', 'instagram', 'Casa', '00000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-000000000002', 'Lead da Maria', '48988886666', 'site',      'Sala', '00000000-0000-0000-0000-0000000000b2'),
  ('10000000-0000-0000-0000-000000000003', 'Lead livre',    '48988885555', 'portal',    'Lote', null);

-- Gestora escreve uma observação no lead do João
insert into public.lead_notes (lead_id, user_id, content) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Cliente prefere contato à tarde.');

\echo '[rls] anon não acessa nada'
set role anon;
do $$ begin
  perform 1 from public.leads;
  raise exception 'anon leu leads';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.distribute_next_lead();
  raise exception 'anon executou distribuição';
exception when insufficient_privilege then null;
end $$;
reset role;

\echo '[rls] corretor vê somente os próprios leads'
select tests.login('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
do $$ begin
  assert (select count(*) from public.leads) = 1, 'João deveria ver 1 lead';
  assert (select name from public.leads) = 'Lead do João';
  assert not exists (select 1 from public.leads where id = '10000000-0000-0000-0000-000000000002');
  assert not exists (select 1 from public.leads where assigned_to is null), 'corretor não vê o reservatório';
end $$;

\echo '[rls] corretor altera a etapa do próprio lead'
do $$ begin
  update public.leads set stage = 'contacting' where id = '10000000-0000-0000-0000-000000000001';
  assert (select stage from public.leads where id = '10000000-0000-0000-0000-000000000001') = 'contacting';
end $$;

\echo '[rls] corretor NÃO altera lead de outro corretor (0 linhas afetadas)'
do $$ declare n int; begin
  update public.leads set stage = 'lost' where id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  assert n = 0, 'João alterou lead da Maria';
end $$;

\echo '[rls] corretor NÃO se atribui lead nem transfere o seu'
do $$ declare n int; begin
  update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000b1' where id = '10000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  assert n = 0, 'João pegou lead do reservatório';
end $$;
do $$ begin
  update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000b2' where id = '10000000-0000-0000-0000-000000000001';
  raise exception 'João transferiu o lead';
exception when insufficient_privilege then null;  -- with check da RLS
end $$;
do $$ begin
  update public.leads set phone = '48900000000' where id = '10000000-0000-0000-0000-000000000001';
  raise exception 'João alterou dados cadastrais';
exception when insufficient_privilege then null;  -- trigger leads_guard
end $$;

\echo '[rls] corretor não cadastra leads'
do $$ begin
  insert into public.leads (name, phone, origin, interest) values ('X', '48911112222', 'site', 'Casa');
  raise exception 'João cadastrou lead';
exception when insufficient_privilege then null;
end $$;

\echo '[rls] observações: corretor escreve nos seus leads, não nos dos outros'
do $$ begin
  insert into public.lead_notes (lead_id, content) values ('10000000-0000-0000-0000-000000000001', 'Liguei, retornar amanhã.');
  assert (select count(*) from public.lead_notes) = 2;
  assert (select user_id from public.lead_notes where content like 'Liguei%') = '00000000-0000-0000-0000-0000000000b1',
    'autor deve ser o usuário autenticado';
end $$;
do $$ begin
  insert into public.lead_notes (lead_id, content) values ('10000000-0000-0000-0000-000000000002', 'invasão');
  raise exception 'João comentou no lead da Maria';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.lead_notes (lead_id, user_id, content)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'forjado');
  raise exception 'João escreveu como outro autor';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.lead_notes set content = 'editado';
  raise exception 'observação editada';
exception when insufficient_privilege then null;
end $$;

\echo '[rls] corretor vê o nome do autor das observações dos seus leads, e nada além'
do $$ begin
  assert exists (select 1 from public.profiles where name = 'Gestora'), 'autor da observação deve ser visível';
  assert not exists (select 1 from public.profiles where name = 'Maria'), 'Maria não deveria ser visível';
end $$;

\echo '[rls] corretor não altera permissões nem acessa tabelas administrativas'
do $$ begin
  update public.profiles set role = 'manager' where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'João virou gestor';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from public.qr_tokens;
  raise exception 'João leu qr_tokens';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.broker_presence (broker_id, valid_until, queue_position, last_checkin_at)
  values ('00000000-0000-0000-0000-0000000000b1', now() + interval '10 hours', 0, now());
  raise exception 'João forjou presença';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.distribution_history (lead_id, broker_id, queue_position_at_distribution)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 1);
  raise exception 'João forjou histórico';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from private.distribution_state;
  raise exception 'João leu o schema privado';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.get_presence_overview();
  raise exception 'João leu a visão administrativa da fila';
exception when insufficient_privilege then null;
end $$;
reset role;

\echo '[rls] gestor vê e gerencia todos os leads'
select tests.login('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
do $$ begin
  assert (select count(*) from public.leads) = 3;
  assert (select count(*) from public.profiles) = 3;
  update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000b2', interest = 'Lote de esquina'
   where id = '10000000-0000-0000-0000-000000000003';
  insert into public.leads (name, phone, origin, interest) values ('Novo lead', '48977776666', 'whatsapp', 'Cobertura');
  assert (select count(*) from public.leads where assigned_to is null) = 1;
end $$;
do $$ begin
  update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000a1' where id = '10000000-0000-0000-0000-000000000003';
  raise exception 'gestor atribuiu lead a um não-corretor';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.leads (name, phone, origin, interest) values ('Telefone ruim', '12', 'site', 'Casa');
  raise exception 'telefone inválido aceito';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.leads (name, phone, origin, interest) values ('Origem ruim', '48977776666', 'tiktok-x', 'Casa');
  raise exception 'origem inválida aceita';
exception when check_violation then null;
end $$;
reset role;

\echo '[integridade] updated_at é mantido pelo banco e created_at é imutável'
do $$
declare v_created timestamptz;
begin
  select created_at into v_created from public.leads where id = '10000000-0000-0000-0000-000000000001';
  update public.leads set created_at = now() - interval '10 years', stage = 'proposal'
   where id = '10000000-0000-0000-0000-000000000001';
  assert (select created_at from public.leads where id = '10000000-0000-0000-0000-000000000001') = v_created;
end $$;

\echo 'OK: RLS e segurança'
