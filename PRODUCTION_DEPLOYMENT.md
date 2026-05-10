# Production Deployment Guide

## Overview

O setup de produção inclui:
- **RabbitMQ**: Message broker para comunicação assíncrona
- **API**: Aplicação Hono que processa requisições HTTP
- **Workers**: Processadores de eventos (email, pagamentos, estoque)

## Prerequisites

- Docker e Docker Compose
- Acesso a banco de dados PostgreSQL (externo)
- Redis (externo)
- Variáveis de ambiente configuradas

## Setup

### 1. Configure as variáveis de ambiente

```bash
cp .env.production.example .env.production
```

Edite `.env.production` com seus valores reais:

```bash
vim .env.production
```

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
# Logs da API
docker-compose -f docker-compose.production.yml logs -f api

# Logs dos Workers
docker-compose -f docker-compose.production.yml logs -f workers

# Logs do RabbitMQ
docker-compose -f docker-compose.production.yml logs -f rabbitmq
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

### RabbitMQ Management Console

Acesse em `http://your-server:15672`
- Username: `guest`
- Password: `guest`

## Escalabilidade

Para rodar múltiplas instâncias de workers:

```bash
docker-compose -f docker-compose.production.yml up -d --scale workers=3
```

## Troubleshooting

### Workers não estão processando eventos

1. Verifique conectividade com RabbitMQ:
```bash
docker-compose -f docker-compose.production.yml exec workers rabbitmqctl status
```

2. Verifique logs de erro:
```bash
docker-compose -f docker-compose.production.yml logs workers
```

### API não responde

1. Verifique health endpoint:
```bash
curl http://localhost:8887/health
```

2. Verifique conectividade com banco de dados:
```bash
docker-compose -f docker-compose.production.yml exec api npm run db:check
```

## Variáveis de Ambiente Obrigatórias

### Banco de dados e infraestrutura
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `RABBITMQ_URL`: URI AMQP. No mesmo `docker-compose.production.yml`, o default é `amqp://guest:guest@rabbitmq:5672/` (**hostname `rabbitmq` = nome do serviço**). Se você sobrescrever com `.env`, não use `localhost` nos contêiners.

**Coolify:** ative **Connect To Predefined Network** (ou equivalente) para API, workers e RabbitMQ ficarem na mesma rede Docker — caso contrário o host resolvido (ex.: `10.0.x.x`) pode recusar `ECONNREFUSED` na porta 5672. Os workers agora **retentam** a conexão AMQP várias vezes ao iniciar; se continuar falhando, o problema é rede/URL, não só timing.

### Autenticação
- `JWT_SECRET`: Secret para JWT tokens (32+ caracteres)
- `JWT_REFRESH_SECRET`: Secret para refresh tokens (32+ caracteres)
- `JWT_ACCESS_TTL_SECONDS`: TTL do access token (ex: 900)
- `JWT_REFRESH_TTL_SECONDS`: TTL do refresh token (ex: 604800)

### Mercado Pago
- `MP_ACCESS_TOKEN`: Token de acesso do Mercado Pago
- `NEXT_PUBLIC_MP_PUBLIC_KEY`: Public key do Mercado Pago
- `MP_WEBHOOK_SECRET`: Secret para validar webhooks
- `MP_NOTIFICATION_URL`: URL pública para receber notificações
- `MP_STATEMENT_DESCRIPTOR`: Descrição que aparece no extrato (ex: "LISTA PRESENTES")

### Email (SMTP - Amazon SES)
- `SMTP_HOST`: Host SMTP (ex: email-smtp.sa-east-1.amazonaws.com)
- `SMTP_PORT`: Porta SMTP (ex: 587)
- `SMTP_SECURE`: true/false
- `SMTP_USER`: Usuário SMTP
- `SMTP_PASSWORD`: Senha SMTP
- `SMTP_FROM_EMAIL`: Email de origem
- `SMTP_FROM_NAME`: Nome de origem

### Cloudflare R2
- `R2_ACCOUNT_ID`: ID da conta R2
- `R2_ACCESS_KEY_ID`: Access Key ID
- `R2_SECRET_ACCESS_KEY`: Secret Access Key
- `R2_BUCKET_NAME`: Nome do bucket

### API e Cookies
- `API_PUBLIC_ORIGIN`: Origem pública da API (ex: https://api.your-domain.com)
- `APP_URL`: URL da aplicação (ex: https://your-domain.com)
- `NEXT_PUBLIC_API_URL`: URL da API para o cliente (ex: https://api.your-domain.com)
- `API_PORT`: Porta host publicada no compose (contêiner escuta **8887** por padrão; mapeamento `API_PORT:-8887:8887`)
- `COOKIE_DOMAIN`: Domínio dos cookies (ex: your-domain.com)
- `COOKIE_SECURE`: true/false (deve ser true em produção)

### Workers
- `WORKERS_CONCURRENCY`: Número de items processados concorrentemente (padrão: 4)

## Recursos Recomendados

- **RabbitMQ**: 512MB RAM
- **API**: 256MB RAM (por instância)
- **Workers**: 256MB RAM (por instância)
