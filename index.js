require('dotenv').config();
const http = require('http');
const { default: makeWASocket, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const config = require('./src/config');
const { createPostgresAuth } = require('./src/postgresAuth');
const { handleIncomingMessage } = require('./src/bot');
const { scheduleData, getCurrentDayKey, getCurrentTimeString, getCurrentDateString } = require('./src/schedule');
const { checkBirthdayByDate } = require('./src/people');

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

        // Функция отправки сообщений во ВСЕ активные группы, куда писал бот
        const activeGroups = new Set();

        async function broadcastToGroups(text) {
            for (const jid of activeGroups) {
                try {
                    await sock.sendMessage(jid, { text });
                } catch (err) {
                    console.error(`[ERROR] Не удалось отправить в группу ${jid}:`, err);
                }
            }
        }

        let notifiedLessons = new Set();
        let endOfDayNotified = false;
        let birthdayCheckedDate = '';

        setInterval(async () => {
            if (!sock.authState.creds.registered) return;

            const timeStr = getCurrentTimeString(); // "HH:MM"
            const dateStr = getCurrentDateString(); // "DD.MM"
            const dayKey = getCurrentDayKey();

            // 1. Проверка Дня Рождения ровно в 00:00
            if (timeStr === '00:00' && birthdayCheckedDate !== dateStr) {
                birthdayCheckedDate = dateStr;
                const birthdayPersons = checkBirthdayByDate(dateStr);
                if (birthdayPersons.length > 0) {
                    for (const person of birthdayPersons) {
                        const bdayText = `${person.name}, с днём рождения! Желаю море позитива, океан любви и целую вселенную счастья. Пусть всё задуманное обязательно сбудется!\n\nРебята давайте всем вместе поздравив ${person.name}`;
                        await broadcastToGroups(bdayText);
                    }
                }
            }

            // Сброс флагов уроков в полночь
            if (timeStr === '00:00') {
                notifiedLessons.clear();
                endOfDayNotified = false;
            }

            // 2. Уведомления об уроках и завершении в 12:30 (только в группы)
            if (dayKey && scheduleData[dayKey]) {
                const lessons = scheduleData[dayKey].lessons;
                for (const lesson of lessons) {
                    const startKey = `${dayKey}-${lesson.subject}-start`;
                    const endKey = `${dayKey}-${lesson.subject}-end`;

                    if (timeStr === lesson.timeStart && !notifiedLessons.has(startKey)) {
                        notifiedLessons.add(startKey);
                        await broadcastToGroups(`🔔 Урок *${lesson.subject}* начинается прямо сейчас (${lesson.timeStart})!`);
                    }

                    if (timeStr === lesson.timeEnd && !notifiedLessons.has(endKey)) {
                        notifiedLessons.add(endKey);
                        await broadcastToGroups(`🏁 Урок *${lesson.subject}* окончен (${lesson.timeEnd}). Переменка!`);
                    }
                }

                if (timeStr === '12:30' && !endOfDayNotified) {
                    endOfDayNotified = true;
                    await broadcastToGroups(`🎉 Уроки закончены! Ты пока жива, и это главное :) Удачи и отличного отдыха!`);
                }
            }
        }, 15000); // Проверка каждые 15 секунд для максимальной точности по минутам

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (!msg.message || msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid;
                // Запоминаем только группы (jid заканчивается на @g.us)
                if (remoteJid && remoteJid.endsWith('@g.us')) {
                    activeGroups.add(remoteJid);
                }

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (!text) continue;

                const replyText = handleIncomingMessage(text);

                if (replyText && remoteJid && remoteJid.endsWith('@g.us')) {
                    await sock.sendMessage(
                        remoteJid,
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
