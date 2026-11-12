-- =============================================================================
-- San Remo CRM — dados fictícios de demonstração
-- =============================================================================
-- PRÉ-REQUISITO: criar as contas no Supabase Auth ANTES deste seed
-- (Dashboard > Authentication > Add user, ou `npm run demo:users`):
--
--   gestor@example.com        Helena Martins  (vira gestora aqui)
--   ana.lima@example.com      Ana Lima        (corretora)
--   bruno.costa@example.com   Bruno Costa     (corretor)
--   carla.souza@example.com   Carla Souza     (corretora)
--   diego.rocha@example.com   Diego Rocha     (corretor)
--
-- Nenhuma senha é definida aqui. O seed é idempotente (pode rodar mais de uma vez).
-- Todos os nomes, telefones e e-mails são fictícios.
-- =============================================================================

do $$
declare
  v_manager uuid;
  v_ana     uuid;
  v_bruno   uuid;
  v_carla   uuid;
  v_diego   uuid;
begin
  -- Papéis e nomes (a promoção a gestor só é possível por SQL administrativo)
  update public.profiles set role = 'manager', name = 'Helena Martins' where lower(email) = 'gestor@example.com';
  update public.profiles set role = 'broker',  name = 'Ana Lima'       where lower(email) = 'ana.lima@example.com';
  update public.profiles set role = 'broker',  name = 'Bruno Costa'    where lower(email) = 'bruno.costa@example.com';
  update public.profiles set role = 'broker',  name = 'Carla Souza'    where lower(email) = 'carla.souza@example.com';
  update public.profiles set role = 'broker',  name = 'Diego Rocha'    where lower(email) = 'diego.rocha@example.com';

  select id into v_manager from public.profiles where lower(email) = 'gestor@example.com';
  select id into v_ana     from public.profiles where lower(email) = 'ana.lima@example.com';
  select id into v_bruno   from public.profiles where lower(email) = 'bruno.costa@example.com';
  select id into v_carla   from public.profiles where lower(email) = 'carla.souza@example.com';
  select id into v_diego   from public.profiles where lower(email) = 'diego.rocha@example.com';

  if v_manager is null or v_ana is null or v_bruno is null or v_carla is null then
    -- Não falha (o `supabase db reset` roda o seed antes de existir qualquer usuário).
    raise notice 'Seed ignorado: crie primeiro as contas de demonstração no Supabase Auth (README, seção "Usuários de demonstração") e rode este arquivo de novo.';
    return;
  end if;

  -- Leads: 6 no reservatório (sem responsável) e 9 distribuídos em etapas variadas
  insert into public.leads (id, name, phone, email, origin, interest, stage, assigned_to, created_at) values
    -- Reservatório (ordem de distribuição: do mais antigo para o mais novo)
    ('d0000000-0000-4000-8000-000000000001', 'Mariana Teixeira',  '48991230001', 'mariana.teixeira@example.com', 'instagram',  'Apartamento 2 quartos em Campinas, até R$ 650 mil.',                'new', null,      now() - interval '3 days 4 hours'),
    ('d0000000-0000-4000-8000-000000000002', 'Gustavo Prado',     '48991230002', null,                           'site',       'Apartamento 2 quartos no Kobrasol, perto de escola.',             'new', null,      now() - interval '2 days 22 hours'),
    ('d0000000-0000-4000-8000-000000000003', 'Renata Albuquerque','48991230003', 'renata.alb@example.com',       'portal',     'Casa térrea com 3 quartos no Forquilhinhas, aceita financiamento.', 'new', null,      now() - interval '2 days 3 hours'),
    ('d0000000-0000-4000-8000-000000000004', 'Otávio Mendes',     '4832560004',  null,                           'plantao',    'Sala comercial de 40 m² no Centro de São José.',                 'new', null,      now() - interval '1 day 6 hours'),
    ('d0000000-0000-4000-8000-000000000005', 'Isabela Fontes',    '48991230005', 'isabela.fontes@example.com',   'google_ads', 'Studio para investimento próximo à UFSC.',                        'new', null,      now() - interval '7 hours'),
    ('d0000000-0000-4000-8000-000000000006', 'Caio Ventura',      '48991230006', null,                           'whatsapp',   'Terreno de 360 m² para construir no Bela Vista.',                 'new', null,      now() - interval '40 minutes'),
    -- Distribuídos
    ('d0000000-0000-4000-8000-000000000007', 'Rafael Gonçalves',  '48991230007', 'rafael.g@example.com',         'portal',     'Casa com quintal no Kobrasol para família com pets.',             'new',        v_ana,   now() - interval '6 days'),
    ('d0000000-0000-4000-8000-000000000008', 'Patrícia Moura',    '48991230008', null,                           'site',       'Sala comercial no Centro de São José.',                           'contacting', v_bruno, now() - interval '8 days'),
    ('d0000000-0000-4000-8000-000000000009', 'Eduardo Pires',     '48991230009', 'eduardo.pires@example.com',    'indicacao',  'Cobertura com vista para o mar em Coqueiros.',                    'scheduled',  v_carla, now() - interval '10 days'),
    ('d0000000-0000-4000-8000-000000000010', 'Luciana Ramos',     '48991230010', null,                           'whatsapp',   'Terreno para construir no Forquilhinhas.',                        'proposal',   v_ana,   now() - interval '12 days'),
    ('d0000000-0000-4000-8000-000000000011', 'Felipe Andrade',    '48991230011', 'felipe.andrade@example.com',   'google_ads', 'Studio para investimento perto da UFSC.',                         'won',        coalesce(v_diego, v_bruno), now() - interval '20 days'),
    ('d0000000-0000-4000-8000-000000000012', 'Juliana Freitas',   '48991230012', null,                           'facebook',   'Apartamento 3 quartos com 2 vagas em Barreiros.',                 'lost',       v_bruno, now() - interval '15 days'),
    ('d0000000-0000-4000-8000-000000000013', 'Thiago Nunes',      '48991230013', 'thiago.nunes@example.com',     'plantao',    'Casa em condomínio fechado, até R$ 1,2 milhão.',                  'contacting', v_carla, now() - interval '5 days'),
    ('d0000000-0000-4000-8000-000000000014', 'Beatriz Lopes',     '48991230014', null,                           'instagram',  'Apartamento mobiliado para locação no Campinas.',                 'won',        v_carla, now() - interval '25 days'),
    ('d0000000-0000-4000-8000-000000000015', 'Marcelo Duarte',    '48991230015', null,                           'indicacao',  'Galpão para logística próximo à BR-101.',                         'scheduled',  v_bruno, now() - interval '4 days')
  on conflict (id) do nothing;

  -- Observações (autor e data)
  insert into public.lead_notes (id, lead_id, user_id, content, created_at) values
    ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000008', v_bruno,   'Primeiro contato feito por telefone. Prefere retorno depois das 17h.', now() - interval '7 days'),
    ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000009', v_carla,   'Visita agendada para sábado às 10h no imóvel de Coqueiros.',           now() - interval '2 days'),
    ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000009', v_manager, 'Cliente indicado por um comprador antigo. Prioridade alta.',          now() - interval '9 days'),
    ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000010', v_ana,     'Proposta enviada: R$ 290 mil à vista. Aguardando resposta.',           now() - interval '1 day'),
    ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000012', v_bruno,   'Cliente comprou com outra imobiliária.',                               now() - interval '3 days')
  on conflict (id) do nothing;
end $$;

-- Observação: o histórico de distribuições e a presença NÃO são semeados de
-- propósito. Eles devem nascer dos fluxos reais (QR Code e roleta), para que a
-- avaliação do Round-Robin parta de um estado limpo e coerente com o cursor.
