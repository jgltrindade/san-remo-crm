# San Remo CRM — Roleta de leads

CRM imobiliário desenvolvido para o desafio técnico Full Stack da **San Remo Imóveis**. O gestor organiza os leads, os corretores confirmam presença por QR Code e a roleta distribui os leads do reservatório entre os corretores presentes, numa fila circular contínua.

## Links da entrega

| | |
|---|---|
| **Aplicação (Vercel)** | https://san-remo-crm.vercel.app |
| **Repositório (GitHub)** | https://github.com/jgltrindade/san-remo-crm |

## Contas de demonstração

Contas criadas exclusivamente para a avaliação. Todos os dados do sistema são fictícios.

| Perfil | E-mail |
|---|---|
| Gestor | `gestor@example.com` |
| Corretor | `ana.lima@example.com` |
| Corretor | `bruno.costa@example.com` |
| Corretor | `carla.souza@example.com` |
| Corretor | `diego.rocha@example.com` |

**Senha:** Todas as contas usam a mesma senha "password".

---

## O que o sistema faz

| Perfil | Funcionalidades |
|---|---|
| **Gestor** | Dashboard com indicadores e gráficos; todos os leads em Kanban ou tabela, com filtros por nome, telefone, etapa, origem e corretor; cadastro e edição de leads; reservatório de leads sem responsável; QR Code de presença; fila de corretores; distribuição de leads; histórico de distribuições. |
| **Corretor** | Vê somente os próprios leads, muda a etapa (arrastando no Kanban ou pelo detalhe do lead), registra observações com data e autor e confirma presença pelo QR Code. |

Funil: **Novo → Em contato → Visita agendada → Proposta → Ganho / Perdido**.

## Tecnologias

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, componentes no padrão shadcn/ui, React Router, TanStack Query, React Hook Form + Zod, Recharts, qrcode.react, date-fns, lucide-react, sonner
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security e funções RPC em PL/pgSQL)
- **Publicação e versionamento:** Vercel e GitHub

As regras críticas rodam no banco: permissões por RLS, validação do QR Code e a distribuição Round-Robin numa única transação com travas. O frontend nunca decide quem recebe um lead.

---

## Como executar o projeto

### 1. Configurar o Supabase

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. **Recriar o banco:** abra **SQL Editor → New query**, cole o conteúdo de [`supabase/setup-completo.sql`](supabase/setup-completo.sql) e clique em **Run**. O painel pode avisar que as tabelas são criadas sem RLS. O aviso é esperado, porque o script ativa o RLS mais adiante. Escolha **Run and enable RLS**. O arquivo reúne, na ordem, as migrations de [`supabase/migrations/`](supabase/migrations/).
3. **Criar os usuários:** em **Authentication → Users → Add user → Create new user**, crie os 5 e-mails da tabela de contas de demonstração, com uma senha e a opção **Auto Confirm User** marcada. Todo usuário novo nasce como corretor.
4. **Popular os dados:** rode [`supabase/seed.sql`](supabase/seed.sql) no SQL Editor. Ele promove `gestor@example.com` a gestor e cria 15 leads fictícios: 6 no reservatório e 9 distribuídos entre as etapas.
5. Recomendado: em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**.

### 2. Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

No `.env.local`, preencha as duas variáveis abaixo com os valores de **Project Settings → API Keys** do Supabase. O [`.env.example`](.env.example) não contém segredos.

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use somente a chave pública. A secret key (`sb_secret_…`) nunca deve ir para o frontend nem para a Vercel.

### 3. Publicar na Vercel

1. Importe o repositório do GitHub em **Vercel → Add New → Project**. O preset Vite é detectado automaticamente.
2. Em **Environment Variables**, adicione as mesmas duas variáveis do `.env.local`.
3. Clique em **Deploy**. Depois, no Supabase, informe a URL publicada em **Authentication → URL Configuration → Site URL**.

---

## Como reproduzir os fluxos principais

Use uma janela normal para o gestor e uma janela anônima para os corretores. Para trocar de corretor, use **Sair**.

**Presença por QR Code**

1. Como gestor, abra **Presença dos corretores**. O QR Code troca sozinho a cada 5 minutos e mostra um contador regressivo. Há também a opção **Abrir em tela cheia**.
2. Leia o QR Code com o celular e entre como corretor. No computador, use **Copiar link** e abra o link na janela do corretor.
3. A presença vale por 5 horas. Uma nova leitura com a presença ainda válida mostra **Presença renovada** e mantém a posição na fila.
4. Um link de um QR Code já substituído é recusado com **QR Code expirado**.

**Fila e distribuição Round-Robin**

1. Confirme a presença de Ana, Bruno e Carla, nessa ordem. Em **Presença dos corretores**, eles aparecem nas posições 1, 2 e 3.
2. Em **Distribuição de leads**, clique em **Distribuir próximo lead** três vezes. Os leads mais antigos do reservatório vão para Ana, Bruno e Carla. A quarta distribuição volta para a Ana.
3. Confirme a presença de Diego: ele entra no **final** da fila, depois de Carla.
4. Se um corretor expirar, ele é ignorado. Se voltar a confirmar presença, entra no final da fila. Para simular a expiração sem esperar 5 horas, rode no SQL Editor:
   ```sql
   update public.broker_presence set valid_until = now() - interval '1 minute'
   where broker_id = (select id from public.profiles where email = 'carla.souza@example.com');
   ```
5. Sem leads no reservatório ou sem corretores habilitados, a tela informa o motivo e nada é alterado.
6. **Histórico de distribuições** lista lead, corretor e data, com ordenação por data.

**CRM**

- **Gestor:** em **Leads**, cadastre um lead sem responsável (ele vai para o reservatório), filtre, edite e registre observações no detalhe.
- **Corretor:** em **Meus leads**, só aparecem os leads dele. Arraste um card para mudar a etapa e registre uma observação. O banco bloqueia o acesso a leads de outros corretores, mesmo fora da interface.

---

## Uso de IA

**Ferramenta:** Claude (Anthropic), modelo Claude Opus 5.5, usado no app Claude com ambiente de execução (terminal, editor de arquivos e PostgreSQL local).

**Em quais partes ajudou:**
- Planejamento da arquitetura e da modelagem do banco.
- Escrita do código do frontend, das migrations, das políticas de segurança e das funções SQL.
- Desenho do algoritmo da fila circular.
- Identificação de riscos de segurança. Exemplos: um usuário se promover a gestor pelos dados do cadastro, um corretor transferir leads, funções expostas a usuários anônimos.
- Orientação na configuração do Supabase e da Vercel.

**Como o resultado foi conferido:**
- **Testes automatizados do banco** (`npm run test:db`, em PostgreSQL), cobrindo:
  - todas as regras da fila: alternância, volta ao início, novo corretor no final, renovação sem mudar a posição, expirado ignorado, retorno no final, bloqueios sem leads ou sem corretores;
  - validade do QR Code;
  - restrições de acesso por perfil.
- **Teste de concorrência:** 45 distribuições simultâneas resultaram em 30 leads distribuídos, nenhum repetido, 10 por corretor e na ordem de cadastro.
- **Checagem de tipos e sintaxe do frontend**, e revisão visual das telas em desktop e celular. A revisão visual levou a ajustes de layout.
- **Teste manual** dos fluxos de ponta a ponta na aplicação publicada, seguindo o roteiro acima.

## Limitações conhecidas

- **Janela curta do QR Code:** só o QR Code vigente é aceito. Se o corretor ler o código nos últimos segundos e ainda precisar fazer login, o código pode expirar no meio do caminho e ele precisa ler o novo. Manter a sessão aberta no celular evita isso.
- **Atualização das telas:** as telas do gestor se atualizam periodicamente (a fila a cada 30 segundos) e após cada ação. Não usam atualização em tempo real.
- **Atribuição manual:** o gestor pode escolher o responsável ao cadastrar ou editar um lead. Essa atribuição não passa pela roleta e não entra no histórico.
- **Fora do escopo:** não há exclusão de leads, observações ou usuários pela interface.
- **Interpretação da regra de fila:** "novo participante entra no final da fila" foi interpretado como o final da lista circular. Exemplo: na fila João, Maria, Pedro, logo depois de João receber, um novo corretor é atendido depois de Pedro e antes da volta para João.
