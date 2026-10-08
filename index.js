require('dotenv').config();
const http = require('http');
const { default: makeWASocket, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const config = require('./src/config');
const { createPostgresAuth } = require('./src/postgresAuth');
const { handleIncomingMessage } = require('./src/bot');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('WhatsApp Bot is Live!');
}).listen(PORT, () => {
    console.log(`[INFO] HTTP-сервер запущен на порту ${PORT}`);
});

async function startBot() {
    console.log('[INFO] Запуск WhatsApp бота...');

    if (!config.databaseUrl) {
        console.error('[ERROR] DATABASE_URL не задан!');
        process.exit(1);
    }

    try {
        const usePostgresAuthState = createPostgresAuth(config.databaseUrl);
        const { state, saveCreds } = await usePostgresAuthState();

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);

        if (!sock.authState.creds.registered) {
            let phoneNumber = config.pairPhone;

            if (phoneNumber) {
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                await delay(3000);
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`\n=================================`);
                    console.log(`КОД ПРИВЯЗКИ: ${code}`);
                    console.log(`=================================\n`);
                } catch (err) {
                    console.error('[ERROR] Ошибка получения кода:', err);
                }
            } else if (process.stdin.isTTY) {
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                const question = (text) => new Promise((resolve) => rl.question(text, resolve));
                phoneNumber = await question('[PROMPT] Введите номер телефона (c кодом страны, без +): ');
                rl.close();
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                await delay(3000);
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n=================================`);
                console.log(`КОД ПРИВЯЗКИ: ${code}`);
                console.log(`=================================\n`);
            } else {
                console.error('[ERROR] Сессия отсутствует или аннулирована. Перепривяжите бота в Termux.');
                return;
            }
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`[INFO] Соединение закрыто (Код: ${statusCode}).`);

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.error('[ERROR] Сессия аннулирована.');
                } else {
                    console.log('[INFO] Повторная попытка подключения через 5 секунд...');
                    await delay(5000);
                    startBot();
                }
            } else if (connection === 'open') {
                console.log('[INFO] WhatsApp успешно подключён!');
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (!msg.message || msg.key.fromMe) continue;

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (!text) continue;

                const replyText = handleIncomingMessage(text);

                if (replyText) {
                    await sock.sendMessage(
                        msg.key.remoteJid,
                        { text: replyText },
                        { quoted: msg }
                    );
                }
            }
        });
    } catch (err) {
        console.error('[ERROR] Ошибка в работе бота:', err);
        await delay(5000);
        startBot();
    }
}

startBot();
