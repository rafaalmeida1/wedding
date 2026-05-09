import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { env } from './env.js';
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import uploadsRoutes from './routes/uploads.js';
import paymentsRoutes from './routes/payments.js';
import webhooksRoutes from './routes/webhooks.js';
import dashboardRoutes from './routes/dashboard.js';
import publicRoutes from './routes/public.js';
import publicR2Routes from './routes/public-r2.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: [env.APP_URL],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/health', (c) => c.json({ ok: true, env: env.NODE_ENV }));

// Webhooks PRECISA estar antes do rate-limit porque o Mercado Pago dispara muitas
// notificações em rajada e a validação de assinatura precisa acessar o raw body.
app.route('/api/webhooks', webhooksRoutes);

app.use('/api/public/*', rateLimit({ max: 400, windowSeconds: 60 }));

app.use('/api/auth/*', rateLimit({ max: 30, windowSeconds: 60 }));
app.use('/api/products/*', rateLimit({ max: 60, windowSeconds: 60 }));
app.use('/api/users/*', rateLimit({ max: 120, windowSeconds: 60 }));
app.use('/api/payments/*', rateLimit({ max: 30, windowSeconds: 60 }));

app.route('/api/auth', authRoutes);
app.route('/api/products', productsRoutes);
app.route('/api/products', uploadsRoutes);
app.route('/api/public', publicR2Routes);
app.route('/api/payments', paymentsRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/users', publicRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error('[error]', err);
  return c.json({ error: 'internal_error' }, 500);
});

const port = env.API_PORT;
console.log(`[api] listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
