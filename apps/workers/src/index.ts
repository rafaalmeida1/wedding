import { startPaymentConsumer } from './consumers/payment.js';
import { startStockConsumer } from './consumers/stock.js';
import { startEmailConsumer } from './consumers/email.js';

async function main() {
  console.log('[workers] starting consumers...');
  const consumers = await Promise.all([
    startPaymentConsumer(),
    startStockConsumer(),
    startEmailConsumer(),
  ]);
  console.log('[workers] all consumers up. Press Ctrl+C to stop.');

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[workers] received ${signal}, disconnecting...`);
    await Promise.all(consumers.map((c) => c.disconnect().catch(() => null)));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[workers] fatal', err);
  process.exit(1);
});
