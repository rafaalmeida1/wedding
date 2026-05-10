# Production Deployment Guide

## Overview

O setup de produção inclui:
- **Redis**: cache, rate-limit na API **e** filas de background (**BullMQ**).
- **API**: Aplicação Hono que processa requisições HTTP e **enfileira** jobs.
- **Workers**: Processam jobs do BullMQ (pagamentos → estoque + e-mail).

Não há RabbitMQ: tudo passa pelo **mesmo `REDIS_URL`**.

## Prerequisites

- Docker e Docker Compose
- Acesso a banco de dados PostgreSQL (externo ou serviço gerenciado)
- **Redis** persistido (filas + app)
- Variáveis de ambiente configuradas

## Setup

### 1. Configure as variáveis de ambiente

```bash
cp .env.production.example .env.production
```

Edite `.env.production` com seus valores reais (especialmente **`REDIS_URL`** e **`DATABASE_URL`**).

### 2. Build das imagens

```bash
docker-compose -f docker-compose.production.yml build
```

### 3. Start dos serviços

```bash
docker-compose -f docker-compose.production.yml up -d
```

### 4. Verificar status

```bash
docker-compose -f docker-compose.production.yml ps
```

### 5. Verificar logs

```bash
docker-compose -f docker-compose.production.yml logs -f api
docker-compose -f docker-compose.production.yml logs -f workers
```

## Gerenciamento

### Parar os serviços

```bash
docker-compose -f docker-compose.production.yml down
```

### Rebuild após mudanças de código

```bash
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d
```

## Escalabilidade

Múltiplas instâncias de workers (todas consomem do **mesmo Redis**):

```bash
docker-compose -f docker-compose.production.yml up -d --scale workers=3
```

## Troubleshooting

### Workers não processam jobs

1. Confirme **`REDIS_URL`** idêntico na API e nos workers (mesmo host/senha/db lógico).
2. No Redis, chaves BullMQ usam o prefixo `wedding:jobs` — não apague manualmente em produção sem motivo.
3. Logs: `docker-compose -f docker-compose.production.yml logs workers`

### API não responde

```bash
curl http://localhost:8887/health
```

## Variáveis de Ambiente Obrigatórias

### Banco de dados e infraestrutura
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis (cache, rate-limit **e** BullMQ). **API + workers devem apontar para a mesma instância** (ou cluster compatível).

### Autenticação
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, TTLs

### Mercado Pago
- `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, etc.

### Email (SMTP), R2, Cookies, API — ver `.env.production.example`.

### Workers
- `WORKERS_CONCURRENCY`: Concorrência BullMQ por fila (padrão sugerido: 4).

## Recursos recomendados

- **Redis**: dimensionar para carga de filas + cache (ex.: 512MB+ conforme tráfego).
- **API**: 256MB RAM (por instância) — ajuste conforme uso.
- **Workers**: 256MB RAM (por instância) — aumente com `--scale` se a fila acumular.
