const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const QRCode = require('qrcode');
const { Client, LocalAuth, RemoteAuth } = require('whatsapp-web.js');
const { PgStore } = require('./pgStore');

const config = require('./config');
const { schedule, dayNames, formatDay } = require('./schedule');
const { people } = require('./people');

// Логи выключены по умолчанию. Включить: переменная LOGS=true
const log = {
  info: (m) => config.logs && console.log(`[INFO] ${m}`),
  warn: (m) => config.logs && console.warn(`[WARN] ${m}`),
  error: (m) => config.logs && console.error(`[ERROR] ${m}`),
  command: (m) => config.logs && console.log(`[COMMAND] ${m}`),
  response: (m) => config.logs && console.log(`[RESPONSE] ${m}`),
};

// Скрываем номер: оставляем только последние 2 цифры
const mask = (id = '') => {
  const d = String(id).replace(/\D/g, '');
  return d ? `***${d.slice(-2)}` : '***';
};

// ---------- Тексты ответов ----------
const DAY_COMMANDS = {
  '/понедельник': 'monday',
  '/вторник': 'tuesday',
  '/среда': 'wednesday',
  '/четверг': 'thursday',
  '/пятница': 'friday',
};

const COMMANDS_COUNT = 8;

const menuText = () =>
  `📚 Расписание ${config.className} класса\n\n` +
  Object.values(dayNames).join('\n') +
  '\n\nНапишите команду, например: /понедельник';

const peopleText = () =>
  `👥 ${config.className} класс\n${config.school}\n\n` +
  people.map((p, i) => `${i + 1}. ${p}`).join('\n');

const helpText = () =>
  `🤖 Бот расписания ${config.className}\n\nДоступные команды:\n\n` +
  '/понедельник — расписание понедельника\n' +
  '/вторник — расписание вторника\n' +
  '/среда — расписание среды\n' +
  '/четверг — расписание четверга\n' +
  '/пятница — расписание пятницы\n' +
  '/расписание — меню расписания\n' +
  '/люди — список учеников\n' +
  '/помощь — список команд';

const unknownText = () =>
  '❓ Неизвестная команда.\n\nИспользуй /помощь, чтобы посмотреть доступные команды.';

// Возвращает { cmd, text } или null, если это не команда
function resolveCommand(body) {
  if (typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (!/^\/\S/.test(trimmed)) return null;

  // первое слово, без регистра, без суффикса @имя
  const cmd = trimmed.split(/\s+/)[0].toLowerCase().split('@')[0];

  if (DAY_COMMANDS[cmd]) return { cmd, text: formatDay(DAY_COMMANDS[cmd]) };
  if (cmd === '/расписание') return { cmd, text: menuText() };
  if (cmd === '/люди') return { cmd, text: peopleText() };
  if (cmd === '/помощь') return { cmd, text: helpText() };
  return { cmd, text: unknownText(), unknown: true };
}

// RemoteAuth в некоторых версиях вызывает afterAuthReady несколько раз подряд
// (в логе «Авторизация успешна» ×3), из-за чего параллельные сохранения
// удаляют архив друг у друга. Запускаем синхронизацию один раз и по очереди.
class SafeRemoteAuth extends RemoteAuth {
  async afterAuthReady() {
    if (this._syncStarted) return undefined;
    this._syncStarted = true;
    return super.afterAuthReady();
  }

  async storeRemoteSession(options) {
    if (this._storing) return undefined;
    this._storing = true;
    try {
      return await super.storeRemoteSession(options);
    } catch (e) {
      log.error(`Не удалось сохранить сессию в базу: ${e.message}`);
      return undefined;
    } finally {
      this._storing = false;
    }
  }
}

// ---------- Бот ----------
function createBot() {
  const events = new EventEmitter();
  const state = {
    status: 'starting', // starting | qr | ready | disconnected | auth_failure
    qr: null,
    code: null,
    message: 'Запуск...',
    commands: COMMANDS_COUNT,
    className: config.className,
  };

  let client = null;
  let starting = false;
  let stopped = false;
  let retries = 0;
  let restartTimer = null;
  const seen = new Set();
  const store = config.databaseUrl ? new PgStore({ connectionString: config.databaseUrl }) : null;

  function setState(patch) {
    Object.assign(state, patch);
    events.emit('state', getState());
  }

  function getState() {
    return { ...state };
  }

  // Удаляем остатки блокировок Chromium после аварийного завершения
  function cleanLocks() {
    try {
      const walk = (dir, depth = 0) => {
        if (depth > 3 || !fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          if (/^Singleton(Lock|Cookie|Socket)$/.test(name)) {
            try { fs.rmSync(full, { force: true }); } catch (_) { /* ignore */ }
          } else {
            let st;
            try { st = fs.statSync(full); } catch (_) { continue; }
            if (st.isDirectory()) walk(full, depth + 1);
          }
        }
      };
      walk(config.sessionPath);
    } catch (_) { /* ignore */ }
  }

  async function destroyClient() {
    if (!client) return;
    const old = client;
    client = null;
    old.removeAllListeners();
    try {
      await Promise.race([
        old.destroy(),
        new Promise((r) => setTimeout(r, 10000)),
      ]);
    } catch (e) {
      log.warn(`Ошибка при закрытии клиента: ${e.message}`);
    }
    // На случай зависшего Chromium
    try {
      const proc = old.pupBrowser && old.pupBrowser.process && old.pupBrowser.process();
      if (proc && !proc.killed) proc.kill('SIGKILL');
    } catch (_) { /* ignore */ }
  }

  function scheduleRestart(reason) {
    if (stopped || restartTimer) return;
    const { baseDelayMs, maxDelayMs } = config.reconnect;
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** retries);
    retries += 1;
    log.warn(`Переподключение через ${Math.round(delay / 1000)} c (${reason})`);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      launch();
    }, delay);
  }

  function buildClient() {
    const c = new Client({
      ...(config.pairPhone
        ? { pairWithPhoneNumber: { phoneNumber: config.pairPhone, showNotification: true, intervalMs: 180000 } }
        : {}),
      authStrategy: store
        ? new SafeRemoteAuth({
            clientId: 'schedule-bot',
            dataPath: config.sessionPath,
            store,
            backupSyncIntervalMs: 60000,
          })
        : new LocalAuth({
            clientId: 'schedule-bot',
            dataPath: config.sessionPath,
          }),
      puppeteer: {
        headless: true,
        executablePath: config.chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
        ],
      },
    });

    c.on('qr', async (qr) => {
      log.info('QR-код создан');
      log.info('Ожидание сканирования...');
      // QR прямо в консоли (Termux, терминал)
      try {
        const ascii = await QRCode.toString(qr, { type: 'terminal', small: false });
        console.log(ascii);
      } catch (_) { /* ignore */ }
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
        setState({ status: 'qr', qr: dataUrl, message: 'Ожидание QR-кода' });
      } catch (e) {
        log.error(`Не удалось создать QR-изображение: ${e.message}`);
      }
    });

    c.on('remote_session_saved', () => log.info('Сессия сохранена в базе данных'));

    c.on('code', (code) => {
      console.log(`Код привязки: ${code}`);
      console.log('WhatsApp → Связанные устройства → Привязка устройства → Привязать по номеру телефона');
      setState({ status: 'qr', qr: null, code, message: 'Введите код привязки' });
    });

    c.on('authenticated', () => {
      log.info('Авторизация успешна');
      setState({ qr: null, message: 'Авторизация...' });
    });

    c.on('auth_failure', async (msg) => {
      log.error(`Ошибка авторизации: ${msg}`);
      setState({ status: 'auth_failure', qr: null, message: 'Ошибка авторизации' });
      await destroyClient();
      scheduleRestart('auth_failure');
    });

    c.on('ready', () => {
      retries = 0;
      log.info('WhatsApp подключён');
      setState({ status: 'ready', qr: null, code: null, message: 'Аккаунт успешно авторизован.' });
    });

    c.on('disconnected', async (reason) => {
      log.warn(`WhatsApp отключился: ${reason}`);
      setState({ status: 'disconnected', qr: null, message: 'Отключён' });
      await destroyClient();
      scheduleRestart(`disconnected: ${reason}`);
    });

    c.on('message_create', (msg) => handleMessage(msg));
    return c;
  }

  async function launch() {
    if (starting || stopped) return;
    starting = true;
    try {
      await destroyClient();
      cleanLocks();
      if (!fs.existsSync(config.sessionPath)) {
        fs.mkdirSync(config.sessionPath, { recursive: true });
      }
      if (store) {
        log.info('Хранилище сессии: Postgres (RemoteAuth)');
        const exists = await store.sessionExists({ session: 'RemoteAuth-schedule-bot' }).catch((e) => {
          log.error(`Нет доступа к базе: ${e.message}`);
          return false;
        });
        if (!exists) log.info('Сессия в базе не найдена, потребуется QR-код');
      } else {
        log.info('Хранилище сессии: локальная папка (LocalAuth)');
        const hasSession = fs.existsSync(path.join(config.sessionPath, 'session-schedule-bot'));
        if (!hasSession) log.info('Сессия не найдена, потребуется QR-код');
      }

      setState({ status: 'starting', qr: null, message: 'Инициализация WhatsApp...' });
      log.info('Инициализация WhatsApp...');

      client = buildClient();
      const current = client;
      await current.initialize();

      // Если Chromium завершился сам — перезапускаем один раз
      if (current.pupBrowser) {
        current.pupBrowser.once('disconnected', async () => {
          if (client !== current || stopped) return;
          log.error('Chromium завершился неожиданно');
          setState({ status: 'disconnected', qr: null, message: 'Браузер завершился' });
          await destroyClient();
          scheduleRestart('chromium crash');
        });
      }
    } catch (e) {
      log.error(`Ошибка запуска WhatsApp: ${e.message}`);
      setState({ status: 'disconnected', qr: null, message: 'Ошибка запуска' });
      await destroyClient();
      scheduleRestart('init error');
    } finally {
      starting = false;
    }
  }

  async function handleMessage(msg) {
    try {
      if (!msg || !msg.body) return;
      const id = msg.id && msg.id._serialized;
      if (id) {
        if (seen.has(id)) return;
        seen.add(id);
        if (seen.size > 500) seen.delete(seen.values().next().value);
      }

      const result = resolveCommand(msg.body);
      if (!result) return; // обычные сообщения игнорируем

      const chatId = msg.fromMe ? msg.to : msg.from;
      const isGroup = String(chatId).endsWith('@g.us');
      log.info(`Получено сообщение (${isGroup ? 'группа' : 'личный чат'}, ${mask(msg.author || msg.from)})`);
      log.command(result.cmd);

      if (!client) return;
      await client.sendMessage(chatId, result.text);
      log.response(result.unknown ? 'Отправлено: неизвестная команда' : `Отправлен ответ на ${result.cmd}`);
    } catch (e) {
      log.error(`Ошибка отправки сообщения: ${e.message}`);
    }
  }

  async function stop() {
    stopped = true;
    if (restartTimer) clearTimeout(restartTimer);
    await destroyClient();
    if (store) await store.close();
  }

  return { start: launch, stop, getState, events };
}

module.exports = { createBot, resolveCommand };

