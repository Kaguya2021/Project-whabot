require('dotenv').config();
const http = require('http');
const { default: makeWASocket, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const config = require('./src/config');
const { createPostgresAuth } = require('./src/postgresAuth');
const { handleIncomingMessage } = require('./src/bot');
const { scheduleData, getCurrentDayKey, getCurrentTimeString } = require('./src/schedule');

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

        // Автоматическая отправка уведомлений в ЛС
        let lastSentDay = '';
        let notifiedLessons = new Set();
        let endOfDayNotified = false;

        setInterval(async () => {
            if (!sock.authState.creds.registered) return;

            const timeStr = getCurrentTimeString();
            const dayKey = getCurrentDayKey();
            const ownerPhone = config.pairPhone ? config.pairPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;

            if (!ownerPhone) return;

            // 1. Авто-рассылка расписания на день строго в 06:00
            if (timeStr === '06:00' && lastSentDay !== dayKey && dayKey) {
                lastSentDay = dayKey;
                const daySchedule = scheduleData[dayKey];
                if (daySchedule) {
                    let msgText = `🌅 Доброе утро, госпожа Кагуя!\nРасписание на сегодня (${daySchedule.name}):\n\n`;
                    daySchedule.lessons.forEach((l, index) => {
                        msgText += `${index + 1}. ${l.timeStart} - ${l.timeEnd} | *${l.subject}*\n`;
                    });
                    try {
                        await sock.sendMessage(ownerPhone, { text: msgText });
                        console.log('[INFO] Утренняя рассылка отправлена.');
                    } catch (err) {
                        console.error('[ERROR] Ошибка рассылки:', err);
                    }
                }
            }

            // Сброс флагов в 00:00
            if (timeStr === '00:00') {
                notifiedLessons.clear();
                lastSentDay = '';
                endOfDayNotified = false;
            }

            // 2. Уведомления об уроках
            if (dayKey && scheduleData[dayKey]) {
                const lessons = scheduleData[dayKey].lessons;
                for (const lesson of lessons) {
                    const startKey = `${dayKey}-${lesson.subject}-start`;
                    const endKey = `${dayKey}-${lesson.subject}-end`;

                    if (timeStr === lesson.timeStart && !notifiedLessons.has(startKey)) {
                        notifiedLessons.add(startKey);
                        const text = `🔔 Урок *${lesson.subject}* начинается прямо сейчас (${lesson.timeStart})!`;
                        await sock.sendMessage(ownerPhone, { text }).catch(() => {});
                    }

                    if (timeStr === lesson.timeEnd && !notifiedLessons.has(endKey)) {
                        notifiedLessons.add(endKey);
                        const text = `🏁 Урок *${lesson.subject}* окончен (${lesson.timeEnd}). Переменка!`;
                        await sock.sendMessage(ownerPhone, { text }).catch(() => {});
                    }
                }

                // 3. Сообщение о завершении уроков строго в 12:30
                if (timeStr === '12:30' && !endOfDayNotified) {
                    endOfDayNotified = true;
                    const endText = `🎉 Уроки закончены! Ты пока жива, и это главное :) Удачи и отличного отдыха!`;
                    await sock.sendMessage(ownerPhone, { text: endText }).catch(() => {});
                    console.log('[INFO] Отправлено финальное сообщение в 12:30.');
                }
            }
        }, 30000);

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
