require('dotenv').config();
const http = require('http');
const { default: makeWASocket, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const config = require('./src/config');
const { createPostgresAuth } = require('./src/postgresAuth');
const { handleIncomingMessage } = require('./src/bot');
const { getCurrentTimeString, getCurrentDateString } = require('./src/schedule');
const { checkBirthdayByDate } = require('./src/people');
const { getAIResponse, handleIncomingAIMessage } = require('./src/ai');

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

        const activeGroups = new Set();

        async function broadcastToGroups(texts) {
            const messages = Array.isArray(texts) ? texts : [texts];
            for (const jid of activeGroups) {
                for (const text of messages) {
                    try {
                        await sock.sendMessage(jid, { text });
                        await delay(1000);
                    } catch (err) {
                        console.error(`[ERROR] Не удалось отправить в группу ${jid}:`, err);
                    }
                }
            }
        }

        let birthdayCheckedDate = '';

        // Фоновый таймер только для проверки дней рождения в 00:00 в группах
        setInterval(async () => {
            if (!sock.authState.creds.registered) return;

            const timeStr = getCurrentTimeString();
            const dateStr = getCurrentDateString();

            if (timeStr === '00:00' && birthdayCheckedDate !== dateStr) {
                birthdayCheckedDate = dateStr;
                const birthdayPersons = checkBirthdayByDate(dateStr);
                if (birthdayPersons.length > 0) {
                    for (const person of birthdayPersons) {
                        const msgs = [
                            `🎉 ${person.name}, с днём рождения! Желаем море позитива, океан счастья и ярких моментов. Пусть всё задуманное обязательно сбудется! ✨`,
                            `💬 Ребята, давайте все вместе поздравим ${person.dat}!)`
                        ];
                        await broadcastToGroups(msgs);
                    }
                }
            }
        }, 15000);

        // Обработка входящих сообщений
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (!msg.message) continue;

                // Перехватываем ответы от Meta AI для команды /ai
                handleIncomingAIMessage(msg);

                if (msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid;
                if (!remoteJid) continue;

                if (remoteJid.endsWith('@g.us')) {
                    activeGroups.add(remoteJid);
                }

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (!text) continue;

                const replyResult = handleIncomingMessage(text);

                if (replyResult) {
                    // Обработка запроса ИИ (/ai)
                    if (typeof replyResult === 'object' && replyResult.type === 'ai') {
                        // 1. Отправляем сообщение с репликой "🔍 Анализирую..."
                        await sock.sendMessage(
                            remoteJid,
                            { text: '🔍 Анализирую...' },
                            { quoted: msg }
                        );

                        // 2. Включаем статус печати
                        await sock.sendPresenceUpdate('composing', remoteJid);

                        // 3. Получаем ответ от ассистента
                        const aiAnswer = await getAIResponse(sock, remoteJid, replyResult.query);

                        await sock.sendPresenceUpdate('paused', remoteJid);

                        // 4. Отправляем чистый ответ ИИ с репликой на сообщение пользователя
                        await sock.sendMessage(
                            remoteJid,
                            { text: aiAnswer },
                            { quoted: msg }
                        );
                    } 
                    // Обработка массива (для /grr — поздравление + призыв ребят)
                    else if (Array.isArray(replyResult)) {
                        for (const part of replyResult) {
                            await sock.sendMessage(remoteJid, { text: part }, { quoted: msg });
                            await delay(800);
                        }
                    } 
                    // Обычный текстовый ответ на команды
                    else {
                        await sock.sendMessage(
                            remoteJid,
                            { text: replyResult },
                            { quoted: msg }
                        );
                    }
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
