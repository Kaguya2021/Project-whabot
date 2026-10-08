const { Pool } = require('pg');
const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

function createPostgresAuth(connectionString) {
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    return async function usePostgresAuthState() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id VARCHAR(255) PRIMARY KEY,
                data TEXT NOT NULL
            );
        `);

        const readData = async (id) => {
            const res = await pool.query('SELECT data FROM whatsapp_sessions WHERE id = $1', [id]);
            if (res.rows.length > 0) {
                return JSON.parse(res.rows[0].data, BufferJSON.reviver);
            }
            return null;
        };

        const writeData = async (id, data) => {
            const value = JSON.stringify(data, BufferJSON.replacer);
            if (data === null || data === undefined) {
                await pool.query('DELETE FROM whatsapp_sessions WHERE id = $1', [id]);
            } else {
                await pool.query(`
                    INSERT INTO whatsapp_sessions (id, data)
                    VALUES ($1, $2)
                    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
                `, [id, value]);
            }
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
                                const value = data[category][id];
                                const key = `${category}-${id}`;
                                tasks.push(writeData(key, value));
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

module.exports = { createPostgresAuth };

