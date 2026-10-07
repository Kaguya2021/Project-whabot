require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Ищем Chromium: сначала из переменной, затем в типичных местах (Render/Docker, Linux, Termux)
function findChromium() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/data/data/com.termux/files/usr/bin/chromium',
  ];
  for (const c of candidates) {
    if (c && c.trim() && fs.existsSync(c.trim())) return c.trim();
  }
  return undefined; // пусть Puppeteer использует свой Chrome
}


module.exports = {
  logs: String(process.env.LOGS || '').toLowerCase() === 'true',
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionPath: path.resolve(process.env.SESSION_PATH || './sessions'),
  pairPhone: (process.env.PAIR_PHONE || '').replace(/\D/g, ''),
  databaseUrl: process.env.DATABASE_URL || '',
  chromiumPath: findChromium(),
  school: '№104 ЖББ мектеби',
  className: '9-В',
  reconnect: {
    baseDelayMs: 5000,
    maxDelayMs: 60000,
  },
};
