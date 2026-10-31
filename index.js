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

const messageStore = new Map();

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
                            `${person.name}, с днём рождения! Желаем море позитива, океан счастья и ярких моментов. Пусть всё задуманное обязательно сбудется! :)`,
                            `Ребята, давайте все вместе поздравим ${person.dat}!)`
                        ];
                        await broadcastToGroups(msgs);
                    }
                }
            }
        }, 15000);

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (!msg.message) continue;

                const remoteJid = msg.key.remoteJid;
                if (!remoteJid) continue;

                if (remoteJid.endsWith('@g.us')) {
                    activeGroups.add(remoteJid);
                }

                const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                const senderParticipant = msg.key.participant || remoteJid;

                if (msg.key && msg.key.id) {
                    messageStore.set(msg.key.id, {
                        participant: senderParticipant,
                        pushName: msg.pushName || '',
                        text: msgText
                    });
                    if (messageStore.size > 1000) {
                        const firstKey = messageStore.keys().next().value;
                        messageStore.delete(firstKey);
                    }
                }

                if (msg.key.fromMe) continue;
                if (!msgText) continue;

                const senderName = msg.pushName || 'Kaguya';
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;

                if (contextInfo && contextInfo.quotedMessage) {
                    const cleanWord = msgText.trim().toLowerCase();
                    if (rpActions[cleanWord]) {
                        await delay(400);

                        const quotedId = contextInfo.stanzaId;
                        const cachedMsg = messageStore.get(quotedId) || {};

                        let participantJid = cachedMsg.participant || contextInfo.participant || remoteJid;
                        
                        // Если это групповой чат, пробуем подтянуть реальный JID участника из метаданных группы
                        if (remoteJid.endsWith('@g.us')) {
                            try {
                                const metadata = await sock.groupMetadata(remoteJid);
                                const foundMember = metadata.participants.find(p => p.id === participantJid || p.id.includes(quotedId));
                                if (foundMember) {
                                    participantJid = foundMember.id;
                                }
                            } catch (e) {}
                        }

                        const quotedText = cachedMsg.text || '';
                        let targetName = cachedMsg.pushName || 'участника';

                        try {
                            const resolvedName = await sock.getName(participantJid);
                            if (resolvedName) targetName = resolvedName;
                        } catch (e) {}

                        const rpResult = processRp(cleanWord, senderName, participantJid, quotedText, targetName);
                        if (rpResult) {
                            await sock.sendMessage(remoteJid, { text: rpResult }, { quoted: msg });
                            continue;
                        }
                    }
                }

                const replyResult = handleIncomingMessage(msgText);

                if (replyResult) {
                    if (typeof replyResult === 'object' && replyResult.type === 'ai') {
                        await sock.sendMessage(
                            remoteJid,
                            { text: 'Анализирую... :)' },
                            { quoted: msg }
                        );

                        await sock.sendPresenceUpdate('composing', remoteJid).catch(() => {});
                        const aiAnswer = await getAIResponse(sock, remoteJid, replyResult.query);
                        await sock.sendPresenceUpdate('paused', remoteJid).catch(() => {});

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
