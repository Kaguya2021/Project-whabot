const { Pool } = require('pg');
const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

let pool = null;

// Один общий пул на весь процесс (раньше новый пул создавался при каждом реконнекте).
function getPool(connectionString) {
    if (!pool) {
        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            max: 5,
            idleTimeoutMillis: 30000
        });
        // Без этого обрыв простаивающего соединения (Neon) роняет весь процесс.
        pool.on('error', (err) => console.error('[pg] ошибка простаивающего клиента:', err.message));
    }
    return pool;
}

function createPostgresAuth(connectionString) {
    const db = getPool(connectionString);

    return async function usePostgresAuthState() {
        await db.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id VARCHAR(255) PRIMARY KEY,
                data TEXT NOT NULL
            );
        `);

        const readData = async (id) => {
            const res = await db.query('SELECT data FROM whatsapp_sessions WHERE id = $1', [id]);
            if (res.rows.length > 0) {
                return JSON.parse(res.rows[0].data, BufferJSON.reviver);
            }
            return null;
        };

        const writeData = async (id, data) => {
            if (data === null || data === undefined) {
                await db.query('DELETE FROM whatsapp_sessions WHERE id = $1', [id]);
                return;
            }
            const value = JSON.stringify(data, BufferJSON.replacer);
            await db.query(`
                INSERT INTO whatsapp_sessions (id, data)
                VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
            `, [id, value]);
        };

        let creds = await readData('creds');
        if (!creds) {
            creds = initAuthCreds();
        }

        return {
            state: {
                creds,
                keys: {
                    get: async (type, ids) => {
                        const data = {};
                        await Promise.all(
                            ids.map(async (id) => {
                                let value = await readData(`${type}-${id}`);
                                if (type === 'app-state-sync-key' && value) {
                                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                                }
                                data[id] = value;
                            })
                        );
                        return data;
                    },
                    set: async (data) => {
                        const tasks = [];
                        for (const category in data) {
                            for (const id in data[category]) {
                                tasks.push(writeData(`${category}-${id}`, data[category][id]));
                            }
                        }
                        await Promise.all(tasks);
                    }
                }
            },
            saveCreds: () => writeData('creds', creds)
        };
    };
}

// Удалить сессию (после выхода из аккаунта), чтобы бот запросил новый код привязки.
async function clearSession(connectionString) {
    await getPool(connectionString).query('DELETE FROM whatsapp_sessions');
}

// Маленькое хранилище состояния бота (например, дата последнего поздравления).
async function ensureStateTable(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS bot_state (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
}

async function getState(connectionString, key) {
    const db = getPool(connectionString);
    await ensureStateTable(db);
    const res = await db.query('SELECT value FROM bot_state WHERE key = $1', [key]);
    return res.rows.length ? res.rows[0].value : null;
}

async function setState(connectionString, key, value) {
    const db = getPool(connectionString);
    await ensureStateTable(db);
    await db.query(`
        INSERT INTO bot_state (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `, [key, String(value)]);
}

module.exports = { createPostgresAuth, clearSession, getState, setState };
