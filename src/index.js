const path = require('path');
const express = require('express');
const config = require('./config');

// Глушим системные предупреждения Node, если логи выключены
if (!config.logs) process.emitWarning = () => {};

const { createBot } = require('./bot');
const out = (...a) => config.logs && console.log(...a);
const err = (...a) => config.logs && console.error(...a);

out('[INFO] Запуск бота...');

const bot = createBot();
const app = express();
const clients = new Set();

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/status', (_req, res) => res.json(bot.getState()));

// Server-Sent Events: статус и QR обновляются без перезагрузки страницы
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(bot.getState())}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

bot.events.on('state', (state) => {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) res.write(payload);
});

// keep-alive, чтобы прокси не рвали соединение
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000);

const server = app.listen(config.port, () => {
  out(`[INFO] Веб-интерфейс: http://localhost:${config.port}`);
  bot.start();
});

process.on('unhandledRejection', (e) => {
  err(`[ERROR] Необработанная ошибка (promise): ${e && e.message ? e.message : e}`);
});
process.on('uncaughtException', (e) => {
  err(`[ERROR] Неожиданный сбой: ${e && e.message ? e.message : e}`);
});

async function shutdown(signal) {
  out(`[INFO] Получен ${signal}, остановка...`);
  server.close();
  await bot.stop();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
