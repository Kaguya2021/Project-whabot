// Хранилище сессии WhatsApp в Postgres (Neon) для RemoteAuth.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');

// RemoteAuth может передавать имя сессии с путём или с .zip — приводим к одному виду
const norm = (s) => path.basename(String(s)).replace(/\.zip$/i, '');

class PgStore {
  constructor({ connectionString }) {
    this.pool = new Pool({ connectionString, max: 2, idleTimeoutMillis: 30000 });
    this.pool.on('error', (e) => config.logs && console.error(`[ERROR] Postgres: ${e.message}`));
    this.ready = this.pool.query(
      `CREATE TABLE IF NOT EXISTS wa_sessions (
         name TEXT PRIMARY KEY,
         data BYTEA NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
  }

  async sessionExists({ session }) {
    await this.ready;
    const r = await this.pool.query('SELECT 1 FROM wa_sessions WHERE name = $1', [norm(session)]);
    return r.rowCount > 0;
  }

  // Сохранения выполняются строго по очереди, чтобы zip не удалили во время чтения
  save({ session }) {
    this.queue = (this.queue || Promise.resolve())
      .catch(() => {})
      .then(() => this._save({ session }));
    return this.queue;
  }

  async _save({ session }) {
    await this.ready;
    const name = norm(session);
    // RemoteAuth может положить zip рядом с процессом или в папку сессий — ищем везде
    const candidates = [
      `${session}.zip`,
      path.resolve(`${name}.zip`),
      path.join(config.sessionPath, `${name}.zip`),
      path.join(path.dirname(config.sessionPath), `${name}.zip`),
    ];
    // Читаем сразу (без проверки exists), чтобы не ловить гонку; архив может появиться с задержкой
    let data;
    for (let i = 0; i < 10 && !data; i += 1) {
      for (const f of candidates) {
        try {
          data = await fs.promises.readFile(f);
          break;
        } catch (_) { /* пробуем следующий путь */ }
      }
      if (!data) await new Promise((r) => setTimeout(r, 500));
    }
    if (!data) {
      // Параллельный вызов уже сохранил и удалил архив — это не ошибка
      if (this.lastSaved && Date.now() - this.lastSaved < 180000) return;
      throw new Error(`Не найден архив сессии: ${candidates.join(' | ')}`);
    }
    await this.pool.query(
      `INSERT INTO wa_sessions (name, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [name, data]
    );
    this.lastSaved = Date.now();
    if (config.logs) console.log(`[INFO] Сессия записана в базу: ${Math.round(data.length / 1024)} КБ`);
  }

  async extract({ session, path: outPath }) {
    await this.ready;
    const r = await this.pool.query('SELECT data FROM wa_sessions WHERE name = $1', [norm(session)]);
    if (!r.rowCount) throw new Error('Сессия не найдена в базе');
    await fs.promises.writeFile(outPath, r.rows[0].data);
    if (config.logs) console.log(`[INFO] Сессия загружена из базы: ${Math.round(r.rows[0].data.length / 1024)} КБ`);
  }

  async delete({ session }) {
    await this.ready;
    await this.pool.query('DELETE FROM wa_sessions WHERE name = $1', [norm(session)]);
  }

  async close() {
    await this.pool.end().catch(() => {});
  }
}

module.exports = { PgStore };

