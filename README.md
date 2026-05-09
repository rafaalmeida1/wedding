# Lista de Presentes de Casamento

Sistema full-stack de lista de presentes de casamento com **Mercado Pago Checkout Transparente** (cartão de crédito, PIX, boleto e cartão de débito virtual Caixa), upload de imagens em Cloudflare R2, e-mails transacionais via Amazon SES, filas **RabbitMQ** para eventos assíncronos e cache em Redis.

Implementação fiel à especificação em `especificacao-lista-presentes.docx`.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion + Mercado Pago Bricks (`@mercadopago/sdk-react`).
- **Backend:** Hono em Node 20 (`@hono/node-server`) + Drizzle ORM + Zod + JWT/bcrypt + `amqplib` (RabbitMQ) + AWS SDK v3 (R2) + Mercado Pago SDK Node (`mercadopago`).
- **Workers:** Consumidores RabbitMQ separados (stock, email, payment).
- **Infra local:** Postgres 16, Redis 7 e RabbitMQ (`rabbitmq:3-management-alpine`) via `docker-compose`.

> **Nota sobre runtime:** a spec original sugere Bun para o `apps/api`. Como o ambiente de desenvolvimento desta máquina não tem Bun, o backend roda em Node 20 com `@hono/node-server` (Plano B previsto no plano de implementação). pnpm é o gerenciador de pacotes do monorepo.

## Estrutura

```
nfc/
├─ apps/
│  ├─ web/        # Next.js 14
│  ├─ api/        # Hono REST + webhooks
│  └─ workers/    # Consumidores RabbitMQ (stock, email, payment)
├─ packages/
│  ├─ db/         # Drizzle schema + migrations + client
│  └─ shared/     # Zod schemas + tipos compartilhados
├─ docker-compose.yml
├─ turbo.json
└─ pnpm-workspace.yaml
```

## Setup local

Pré-requisitos: Node 20+, pnpm 10+, Docker.

```bash
pnpm install
cp .env.example .env

# Opcional — só overrides locais do Next (ele já carrega /.env pela raiz)
# cp apps/web/.env.local.example apps/web/.env.local

pnpm infra:up
pnpm db:migrate
pnpm dev
```

Ferramentas de inspeção:

- **Postgres:** `pnpm db:studio` (Drizzle Studio).
- **RabbitMQ:** management UI em http://localhost:15672 (`guest` / `guest`).
- **Redis:** `docker exec -it wedding-redis redis-cli`.

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe `web`, `api` e `workers` em paralelo. |
| `pnpm build` | Build de todos os apps. |
| `pnpm typecheck` | Type-check em todo o monorepo. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Testes (Playwright e2e na Fase 10). |
| `pnpm db:generate` | Gera migration a partir do schema. |
| `pnpm db:migrate` | Aplica migrations no Postgres. |
| `pnpm db:studio` | Abre Drizzle Studio. |
| `pnpm infra:up` / `infra:down` / `infra:reset` | Controla docker-compose. |

## Fases (`especificacao-lista-presentes.docx` §14)

1. Setup Next.js + Hono + Postgres (Drizzle) + Auth JWT.
2. CRUD de produtos + upload R2 via presigned URL.
3. Mercado Pago Checkout Transparente (cartão).
4. Webhook MP → Hono → RabbitMQ → workers (estoque + e-mail).
5. Animações Framer Motion (NFC core, processing, success, receipt).
6. PIX, boleto e débito virtual Caixa via Mercado Pago (fluxo assíncrono com polling).
7. Reset de senha com Amazon SES.
8. Dashboard de pagamentos.
9. Redis (cache + rate-limit + blacklist).
10. Tema casamento, responsividade, e2e Playwright, CI.

## Mercado Pago — Setup completo

### 1. Criar a aplicação no painel

1. Acesse **https://www.mercadopago.com.br/developers/panel/app** e clique em **Criar aplicação**.
2. Tipo: **CheckOut Pago Online** → "Pagamentos online (Checkout API)".
3. Após criar, abra a aplicação e vá em **Credenciais**. Você vai ver dois pares:
   - **Credenciais de produção** (`APP_USR-...`)
   - **Credenciais de teste** (`TEST-...`)

   Cada par contém **Public Key** (frontend) e **Access Token** (backend).

### 2. Configurar `.env`

Em `.env` (raiz) preencha as duas chaves de teste para começar:

```env
MP_ACCESS_TOKEN=TEST-1234567890-...        # backend (Access Token)
NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-abcdef...   # frontend (Public Key)
MP_STATEMENT_DESCRIPTOR=LISTA PRESENTES    # texto na fatura do cartão (≤22 chars)
```

> Em produção troque para `APP_USR-...` mantendo a separação Public Key (no frontend / Next.js) vs Access Token (apenas no backend / Hono).

### 3. Cadastrar a chave Pix

Para receber via PIX, abra o painel da sua **conta Mercado Pago** (não no developers) → **Cobrar** → **Receber por Pix** → cadastre uma chave (CPF, e-mail ou aleatória).

### 4. Configurar o webhook (Notificações)

O backend expõe `POST /api/webhooks/mercadopago`. Em produção configure assim:

1. **https://www.mercadopago.com.br/developers/panel/notifications/webhooks**
2. Clique em **Configurar notificações** → escolha **Webhooks (URL)**.
3. URL de produção: `https://<seu-dominio>/api/webhooks/mercadopago`
4. Eventos: marque pelo menos **Pagamentos** (`payment`).
5. Copie a **Chave secreta** que o painel gera e coloque em `MP_WEBHOOK_SECRET` no `.env` do backend.

### 5. Webhook em desenvolvimento (com `ngrok`)

Como o Mercado Pago precisa de uma URL pública para enviar notificações, em dev você precisa expor o `localhost:8080`. Recomendado: `ngrok` (ou `cloudflared`).

```bash
# instala ngrok no WSL/Linux uma vez
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc > /dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update && sudo apt install -y ngrok
ngrok config add-authtoken <SEU_TOKEN_NGROK>

# expõe o backend Hono
ngrok http 8080
```

Copie a URL HTTPS que aparece (algo como `https://abcd-1234.ngrok-free.app`) e:

1. Cole em `MP_NOTIFICATION_URL` do `.env`:  
   `MP_NOTIFICATION_URL=https://abcd-1234.ngrok-free.app/api/webhooks/mercadopago`
2. Cadastre essa mesma URL nas Notificações do painel MP.

> Em dev sem `MP_WEBHOOK_SECRET`, a validação de assinatura é desligada (com warning) — você pode usar o botão **"Simular notificação"** do próprio painel para testar.

### 6. Cartões de teste (sandbox)

Use estes cartões com a Public/Access Token de teste:

| Bandeira | Número | Status |
|---|---|---|
| Mastercard | `5031 4332 1540 6351` | aprovado |
| Visa | `4235 6477 2802 5682` | aprovado |
| Visa | `4509 9535 6623 3704` | recusado |

CVV: `123` · Validade: qualquer data futura · Titular: `APRO` (aprovado) ou `OTHE` (outros status) · CPF de teste: `12345678909`.

Documentação completa: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-cards

### 7. PIX, boleto e débito Caixa em sandbox

- **PIX**: o checkout retorna QR Code + copia/cola. Em sandbox você não paga de verdade — clique em **"Simular notificação"** no painel MP para forçar a aprovação.
- **Boleto**: retorna URL do PDF. Em sandbox não há banco real; use o simulador também.
- **Débito virtual Caixa**: retorna URL para a Caixa. Igualmente, simule a aprovação.

## Fluxo de pagamento

```
Cliente                      Frontend (Next)              Backend (Hono)              Mercado Pago
  │                                │                            │                          │
  │ 1. Clica "Pagar"               │                            │                          │
  │──────────────────────────────►│                            │                          │
  │                                │ 2. Mostra Payment Brick    │                          │
  │                                │ (carrega Public Key)       │                          │
  │ 3. Preenche cartão/PIX/boleto │                            │                          │
  │──────────────────────────────►│                            │                          │
  │                                │ 4. Brick tokeniza cartão   │                          │
  │                                │ (PCI-SAQ-A no client)      │                          │
  │                                │ 5. POST /api/payments      │                          │
  │                                │───────────────────────────►│                          │
  │                                │                            │ 6. payment.create        │
  │                                │                            │─────────────────────────►│
  │                                │                            │ 7. ID + status + QR/URL  │
  │                                │                            │◄─────────────────────────│
  │                                │ 8. status + QR/URL         │                          │
  │                                │◄───────────────────────────│                          │
  │ 9. Mostra QR/boleto/aprovado  │                            │                          │
  │                                │                            │                          │
  │ ... usuário paga ...           │                            │                          │
  │                                │                            │ 10. webhook payment.upd  │
  │                                │                            │◄─────────────────────────│
  │                                │                            │ 11. publish queues      │
  │                                │                            │ ──► RabbitMQ ─► workers │
  │                                │ 12. polling /status        │                          │
  │                                │───────────────────────────►│                          │
  │                                │ 13. status: approved       │                          │
  │                                │◄───────────────────────────│                          │
  │ 14. Tela de sucesso            │                            │                          │
```

Os pagamentos por cartão respondem síncronos (status já vem `approved` ou `rejected`); PIX, boleto e débito virtual Caixa retornam `pending` e o frontend pollar `GET /api/payments/:id/status` a cada 4s até aprovação (que vem por webhook _ou_ por consulta direta ao MP, o que vier primeiro).

## Testes

```bash
# instalação one-time dos browsers do Playwright
pnpm --filter @apps/web test:install

# rodar e2e (requer `pnpm dev` rodando em outro terminal)
pnpm --filter @apps/web test
```

## CI

`.github/workflows/ci.yml` cobre:

1. `lint` + `typecheck` + `build` em todos os pacotes (com Postgres em service container).
2. Job de Playwright que sobe API + Next.js e roda os testes contra um Postgres + Redis efêmeros. Disparado em PRs e na `main`.

## Notas de implementação

- **Runtime do `apps/api`:** seguindo o "Plano B" do plano original, a API roda em Node 20 com `@hono/node-server` em vez de Bun.
- **`username` da spec §4.1:** a tabela `users` original não declara essa coluna; foi adicionada como `text unique not null` para suportar a rota pública `/[username]`.
- **Ordem dos middlewares no Hono:** o webhook do MP é registrado *antes* do rate-limit porque a validação de assinatura precisa ler o raw body sem mexer.
- **Cache de estoque:** write-through em `GET /api/users/:username/products`, invalidação no `stock-consumer` e em todas as mutações em `apps/api/src/routes/products.ts`.
- **Por que `mp_payment_id` (text) e não int?** A MP retorna `id` numérico, mas convertemos para string ao persistir para evitar overflow em JS (>2^53) e simplificar uso em URLs.

## Integrações externas (env vars)

### Mercado Pago

```env
# .env (raiz) — backend lê todas as MP_*; frontend lê apenas NEXT_PUBLIC_MP_PUBLIC_KEY
MP_ACCESS_TOKEN=APP_USR-... ou TEST-...
NEXT_PUBLIC_MP_PUBLIC_KEY=APP_USR-... ou TEST-...
MP_WEBHOOK_SECRET=                         # secret das Notificações (HMAC-SHA256)
MP_NOTIFICATION_URL=https://.../api/webhooks/mercadopago   # URL pública (ngrok em dev)
MP_STATEMENT_DESCRIPTOR=LISTA PRESENTES    # texto na fatura do cartão (máx 22 chars)
```

### Cloudflare R2

**Dois jeitos de exibir fotos:**

1. **URL pública no bucket** — habilite **Public Development URL** ou **Custom domain** no bucket. Defina `R2_PUBLIC_URL` (ex.: `https://pub-….r2.dev`). Nunca use `https://<account>.r2.cloudflarestorage.com`: é só API S3 (sem GET anônimo).
2. **Bucket totalmente privado** — deixe `R2_PUBLIC_URL` **vazio** e defina `API_PUBLIC_ORIGIN` igual à URL onde a API é acessada (costuma ser o mesmo valor que `NEXT_PUBLIC_API_URL`). Cada foto fica em `{API_PUBLIC_ORIGIN}/api/public/r2/products/...` e a API lê o objeto com credenciais S3.

**Credenciais de upload e leitura (proxy):** Cloudflare → **R2 → Manage R2 API Tokens** → criar token com **Object Read & Write** no bucket. Isso gera **Access Key ID** + **Secret** compatíveis com o SDK AWS. Tokens gerais da conta (`cfat_…`) **não** servem no lugar desse par.

```env
R2_ACCOUNT_ID=<account_id>
R2_ACCESS_KEY_ID=<r2_s3_access_key>
R2_SECRET_ACCESS_KEY=<r2_s3_secret>
R2_BUCKET_NAME=wedding

# Modo público (opcional):
# R2_PUBLIC_URL=https://pub-xxxxxxxxxxxx.r2.dev

# Modo bucket privado — obrigatório se R2_PUBLIC_URL estiver vazio:
API_PUBLIC_ORIGIN=http://localhost:8080
```

Montagem: **`NEXT_PUBLIC_API_URL` e `API_PUBLIC_ORIGIN`** devem ser a mesma URL pública da API para o proxy funcionar nos `<img>` e no `next/image`.

Se você **habilitar** uma URL pública só Cloudflare (`pub-….r2.dev` ou domínio customizado no bucket), pode definir `R2_PUBLIC_URL`; caso contrário, **`R2_PUBLIC_URL` pode ficar vazio ou até conter erroneamente `*.r2.cloudflarestorage.com` — o backend detecta isso e usa automaticamente** `…/api/public/r2/{key}` na API.

---

## Produção: Vercel + API própria (`casar.bitrafa.com.br` + `api-casar.bitrafa.com.br`)

| Onde | URL | O quê |
|------|-----|--------|
| **Vercel** | `https://casar.bitrafa.com.br` | Next.js |
| **Servidor** | `https://api-casar.bitrafa.com.br` | Hono (`apps/api`) + `apps/workers` + Postgres/Redis/RabbitMQ |

Use **só o `.env` na raiz** no servidor (copie o modelo de `.env.example`). Na Vercel cadastre apenas o que o browser precisa (`NEXT_PUBLIC_*`).

### Backend (`.env` no servidor)

Pontos críticos para o seu deploy:

```env
NODE_ENV=production
APP_URL=https://casar.bitrafa.com.br
NEXT_PUBLIC_API_URL=https://api-casar.bitrafa.com.br
API_PUBLIC_ORIGIN=https://api-casar.bitrafa.com.br
COOKIE_DOMAIN=.bitrafa.com.br
COOKIE_SECURE=true

# Filas (Coolify recurso RabbitMQ ou URI amqps://...)
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672/

MP_ACCESS_TOKEN=APP_USR-...
MP_NOTIFICATION_URL=https://api-casar.bitrafa.com.br/api/webhooks/mercadopago
MP_WEBHOOK_SECRET=<secret gerado no painel Webhooks>

R2_BUCKET_NAME=wedding
R2_PUBLIC_URL=
# (vazio ou lixo *.cloudflarestorage.com → servidor usa proxy /api/public/r2/)
```

Reverse proxy (Nginx/Caddy) com TLS apontando para a API na porta interna `API_PORT` (ex.: 8080).

### Vercel — Environment Variables (Production)

| Variável | Valor |
|---------|--------|
| `NEXT_PUBLIC_API_URL` | `https://api-casar.bitrafa.com.br` |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public Key de **produção** da aplicação Mercado Pago |

### Mercado Pago — notificações e webhook (produção)

1. **[Credenciais da aplicação](https://www.mercadopago.com.br/developers/panel/app)**  
   Em modo **Produção**, copie **Access Token** (`MP_ACCESS_TOKEN` no servidor) e **Public Key** (Vercel / `NEXT_PUBLIC_MP_PUBLIC_KEY`).
2. **[Webhooks](https://www.mercadopago.com.br/developers/panel/notifications/webhooks)**  
   - **URL:** `https://api-casar.bitrafa.com.br/api/webhooks/mercadopago`  
   - **Eventos:** **Pagamentos**.  
   - Guarde a **assinatura secreta** em `MP_WEBHOOK_SECRET`.  
3. **`MP_NOTIFICATION_URL`** no `.env` da API: mesma URL HTTPS do item 2 (o backend envia isso na criação do pagamento onde a MP espera).  
4. **HTTPS obrigatório** na API para a MP aceitar a URL.  
5. **Simular notificação** no painel para validar `200` e logs `[mp-webhook]`.  
6. **Pix**: na sua **conta Mercado Pago**, cadastre uma chave Pix (produção).

Documentação oficial: [Webhooks — segurança (`x-signature`)](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#bookmark_seguran%C3%A7a).

### Amazon SES (via SMTP)

```env
SMTP_HOST=email-smtp.<region>.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false             # true só se usar 465 (SMTPS)
SMTP_USER=<smtp_user>
SMTP_PASSWORD=<smtp_password>
SMTP_FROM_EMAIL=no-reply@seudominio.com
SMTP_FROM_NAME=Lista de Presentes
```

Os e-mails são enviados pelo `email-consumer` em `apps/workers` via `nodemailer`. Em desenvolvimento (sem credenciais) o consumer apenas loga o envio sem falhar.
