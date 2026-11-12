#!/usr/bin/env node
// =============================================================================
// Cria (ou confirma) as contas de demonstração no Supabase Auth.
//
// Roda SOMENTE na sua máquina — usa a chave secreta do projeto, que ignora
// RLS e nunca deve ir para o frontend nem para a Vercel.
//
// Uso:
//   1. Crie .env.local com SUPABASE_URL, SUPABASE_SECRET_KEY e DEMO_PASSWORD
//   2. npm run demo:users
//   3. Rode supabase/seed.sql (promove a gestora e cria os leads)
//
// A senha vem de DEMO_PASSWORD e não fica gravada no código.
// =============================================================================
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
// "Secret key" (projetos novos) ou "service_role key" (projetos antigos)
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error('Defina SUPABASE_URL, SUPABASE_SECRET_KEY e DEMO_PASSWORD em .env.local.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('DEMO_PASSWORD deve ter pelo menos 8 caracteres.');
  process.exit(1);
}

const USERS = [
  { email: 'gestor@example.com', name: 'Helena Martins' },
  { email: 'ana.lima@example.com', name: 'Ana Lima' },
  { email: 'bruno.costa@example.com', name: 'Bruno Costa' },
  { email: 'carla.souza@example.com', name: 'Carla Souza' },
  { email: 'diego.rocha@example.com', name: 'Diego Rocha' },
];

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

for (const user of USERS) {
  const { error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { name: user.name },
  });
  if (!error) console.log(`criado      ${user.email}`);
  else if (/already|registered|exists/i.test(error.message)) console.log(`já existia  ${user.email}`);
  else {
    console.error(`erro        ${user.email}: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log('\nPróximo passo: execute supabase/seed.sql no SQL Editor (ou `supabase db reset`).');
