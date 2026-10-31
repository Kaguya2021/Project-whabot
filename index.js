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
const { getAIResponse } = require('./src/ai');
const { processRp, rpActions } = require('./src/rp');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OK');
}).listen(PORT);

async function startBot() {
    if (!config.databaseUrl) return;

    try {
        const usePostgresAuthState = createPostgresAuth(config.databaseUrl);
        const { state, saveCreds } = await usePostgresAuthState();

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);

        if (!sock.authState.creds.registered && config.pairPhone) {
            const phoneNumber = config.pairPhone.replace(/[^0-9]/g, '');
            await delay(3000);
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`КОД ПРИВЯЗКИ: ${code}`);
            } catch (err) {}
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut && statusCode !== 401) {
                    await delay(5000);
                    startBot();
                }
            }
        });

        const activeGroups = new Set();

        async function broadcastToGroups(texts) {
            const messages = Array.isArray(texts) ? texts : [texts];
            for (const jid of activeGroups) {
                for (const text of messages) {
                    try {
                        await sock.sendMessage(jid, { text });
                        await delay(800);
                    } catch (err) {}
                }
            }
        }

        let birthdayCheckedDate = '';

        // Проверка дней рождения ровно в 00:00 в группах
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
                if (!msg.message || msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid;
                if (!remoteJid) continue;

                if (remoteJid.endsWith('@g.us')) {
                    activeGroups.add(remoteJid);
                }

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (!text) continue;

                const senderName = msg.pushName || 'Участник';
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;

                // Проверяем RP-команду по реплаю (если это ответ на чье-то сообщение и текст — точное слово RP)
                if (contextInfo && contextInfo.quotedMessage) {
                    const cleanWord = text.trim().toLowerCase();
                    if (rpActions[cleanWord]) {
                        // Пытаемся найти имя автора процитированного сообщения
                        // В WhatsApp имя может содержаться в контексте или определяться через pushName
                        let targetName = 'участника';
                        if (contextInfo.participant) {
                            // Можно достать из pushName если передано, либо выделить из JID/хранилища
                            const participantJid = contextInfo.participant;
                            targetName = participantJid.split('@')[0]; 
                        }

                        const rpResult = processRp(cleanWord, senderName, targetName);
                        if (rpResult) {
                            await sock.sendMessage(remoteJid, { text: rpResult }, { quoted: msg });
                            continue;
                        }
                    }
                }

                // Обычные команды бота
                const replyResult = handleIncomingMessage(text);

                if (replyResult) {
                    if (typeof replyResult === 'object' && replyResult.type === 'ai') {
                        await sock.sendMessage(
                            remoteJid,
                            { text: '🔍 Анализирую...' },
                            { quoted: msg }
                        );

                        await sock.sendPresenceUpdate('composing', remoteJid);
                        const aiAnswer = await getAIResponse(sock, remoteJid, replyResult.query);
                        await sock.sendPresenceUpdate('paused', remoteJid);

                        await sock.sendMessage(
                            remoteJid,
                            { text: aiAnswer },
                            { quoted: msg }
                        );
                    } else if (Array.isArray(replyResult)) {
                        for (const part of replyResult) {
                            await sock.sendMessage(remoteJid, { text: part }, { quoted: msg });
                            await delay(600);
                        }
                    } else {
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
        await delay(5000);
        startBot();
    }
}

startBot();
