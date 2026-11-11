require('dotenv').config();
const http = require('http');
const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    delay,
    normalizeMessageContent
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./src/config');
const { createPostgresAuth, clearSession, getState, setState } = require('./src/postgresAuth');
const { handleIncomingMessage } = require('./src/bot');
const { getCurrentTimeString, getCurrentDateString, getCurrentYearString } = require('./src/schedule');
const { checkBirthdayByDate, buildBirthdayMessages } = require('./src/people');
const { getAIResponse } = require('./src/ai');
const { processRp, rpActions, personKeyFromJids, nameByJid } = require('./src/rp');
const { createHandler: createAttendanceHandler } = require('./src/attendance');
const { createRelations, RELATION_WORDS, ACCEPT_WORDS, DECLINE_WORDS, isRelationCommand } = require('./src/relations');

// ---------- защита от падений ----------
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

// ---------- http для пинговалки ----------
const PORT = process.env.PORT || 3000;
http.createServer(createAttendanceHandler({ send: sendReportToGroup })).listen(PORT);

// Отчёт уходит ТОЛЬКО в одну группу — REPORT_GROUP_JID
async function sendReportToGroup(text) {
    const jid = (process.env.REPORT_GROUP_JID || '').trim();
    if (!jid) {
        const list = [...groupMetaCache.entries()]
            .map(([id, v]) => `${v.data?.subject || 'без названия'} — ${id}`).join('\n');
        throw new Error('Не задан REPORT_GROUP_JID в .env.' + (list ? `\nГруппы бота:\n${list}` : ''));
    }
    if (!sock || !connected) throw new Error('Бот не подключён к WhatsApp');
    await sock.sendMessage(jid, { text });
}

// ---------- состояние ----------
const messageStore = new Map();          // id сообщения -> кто написал и что
const groupMetaCache = new Map();        // jid группы -> { t, data }
const GROUP_META_TTL = 10 * 60 * 1000;
const activeGroups = new Set(config.groupJids);

const relations = createRelations({
    load: () => getState(config.databaseUrl, 'relations'),
    save: (value) => setState(config.databaseUrl, 'relations', value)
});

let sock = null;
let connected = false;
let starting = false;
let reconnectTimer = null;

// ---------- помощники ----------
function scheduleReconnect(ms = 5000) {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot();
    }, ms);
}

function getText(content) {
    return (
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        ''
    );
}

function getContextInfo(content) {
    for (const value of Object.values(content)) {
        if (value && typeof value === 'object' && value.contextInfo) return value.contextInfo;
    }
    return null;
}

const normJid = (jid) => String(jid).replace(/:\d+@/, '@');

async function getGroupMeta(s, jid) {
    const cached = groupMetaCache.get(jid);
    if (cached && Date.now() - cached.t < GROUP_META_TTL) return cached.data;
    try {
        const data = await s.groupMetadata(jid);
        groupMetaCache.set(jid, { t: Date.now(), data });
        return data;
    } catch (err) {
        return cached ? cached.data : null;
    }
}

async function refreshGroups(s) {
    try {
        const groups = await s.groupFetchAllParticipating();
        for (const [jid, data] of Object.entries(groups)) {
            activeGroups.add(jid);
            groupMetaCache.set(jid, { t: Date.now(), data });
        }
        console.log(`Групп найдено: ${Object.keys(groups).length}`);
        for (const [jid, data] of Object.entries(groups)) console.log(`  группа: ${data.subject} — ${jid}`);
    } catch (err) {
        console.error('Не удалось получить список групп:', err.message);
    }
}

// Собираем ВСЕ возможные идентификаторы человека (в т.ч. номер за @lid),
// чтобы потом найти его номер в таблице из rp.js и получить постоянный ключ.
async function expandJids(s, remoteJid, initial) {
    const jids = new Set();
    const add = (v) => { if (typeof v === 'string' && v.includes('@')) jids.add(normJid(v)); };
    initial.forEach(add);

    if (remoteJid.endsWith('@g.us')) {
        const meta = await getGroupMeta(s, remoteJid);
        if (meta && Array.isArray(meta.participants)) {
            const known = new Set(jids);
            for (const p of meta.participants) {
                const ids = [p.id, p.lid, p.jid, p.phoneNumber, p.pn].filter(x => typeof x === 'string');
                if (ids.some(x => known.has(normJid(x)))) ids.forEach(add);
            }
        }
    }

    for (const jid of [...jids]) {
        if (!jid.endsWith('@lid')) continue;
        try {
            const pn = await s.signalRepository?.lidMapping?.getPNForLID?.(jid);
            add(pn);
        } catch (e) { /* не поддерживается этой версией — не страшно */ }
    }

    return [...jids];
}

// Кому адресовано RP/предложение (автор цитируемого сообщения)
async function resolveRpTarget(s, remoteJid, ctx) {
    const cached = messageStore.get(ctx.stanzaId) || {};
    const jids = await expandJids(s, remoteJid, [cached.participant, cached.participantAlt, ctx.participant]);
    return { jids, pushName: cached.pushName || '' };
}

function nameFromJids(jids) {
    for (const jid of jids) {
        const n = nameByJid(jid);
        if (n) return n;
    }
    return '';
}

// Кто написал сообщение: { key, name }
async function resolveSender(s, msg, remoteJid) {
    const initial = [msg.key.participant, msg.key.participantAlt, msg.key.participantPn, msg.key.senderPn];
    if (!remoteJid.endsWith('@g.us')) initial.push(remoteJid);
    const jids = await expandJids(s, remoteJid, initial);
    return { key: personKeyFromJids(jids), name: msg.pushName || nameFromJids(jids) || '' };
}

async function broadcastToGroups(texts) {
    const messages = Array.isArray(texts) ? texts : [texts];
    for (const jid of activeGroups) {
        for (const text of messages) {
            try {
                await sock.sendMessage(jid, { text });
                await delay(800);
            } catch (err) {
                console.error('Ошибка рассылки в', jid, err.message);
            }
        }
    }
}

// ---------- поздравления с ДР: 06:00 по КР ----------
let birthdayCheckedKey = '';
let birthdayBusy = false;

async function checkBirthdays() {
    if (!sock || !connected || birthdayBusy) return;

    const timeStr = getCurrentTimeString();
    if (timeStr < config.birthdayTime || timeStr >= config.birthdayWindowEnd) return;

    const dateStr = getCurrentDateString();
    const key = `${getCurrentYearString()}-${dateStr}`;
    if (birthdayCheckedKey === key) return;

    birthdayBusy = true;
    try {
        const persons = checkBirthdayByDate(dateStr);
        if (persons.length === 0) {
            birthdayCheckedKey = key;
            return;
        }

        // Уже поздравляли сегодня (например, бот перезапускался)?
        const lastSent = await getState(config.databaseUrl, 'birthday_last_sent');
        if (lastSent === key) {
            birthdayCheckedKey = key;
            return;
        }

        if (activeGroups.size === 0) await refreshGroups(sock);
        if (activeGroups.size === 0) return; // групп нет — попробуем на следующем тике

        for (const person of persons) {
            await broadcastToGroups(buildBirthdayMessages(person));
        }

        await setState(config.databaseUrl, 'birthday_last_sent', key);
        birthdayCheckedKey = key;
    } catch (err) {
        console.error('Ошибка проверки ДР:', err.message);
    } finally {
        birthdayBusy = false;
    }
}

setInterval(() => { checkBirthdays().catch(() => {}); }, 15000);

// ---------- обработка входящих ----------
async function handleMessage(s, msg) {
    if (!msg.message) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid === 'status@broadcast') return;

    if (remoteJid.endsWith('@g.us')) activeGroups.add(remoteJid);

    // normalizeMessageContent разворачивает ephemeral / viewOnce обёртки
    const content = normalizeMessageContent(msg.message) || {};
    const msgText = getText(content);
    const senderParticipant = msg.key.participant || remoteJid;

    if (msg.key.id) {
        messageStore.set(msg.key.id, {
            participant: senderParticipant,
            participantAlt: msg.key.participantAlt || msg.key.participantPn || msg.key.senderPn || null,
            pushName: msg.pushName || '',
            text: msgText
        });
        if (messageStore.size > 1000) {
            messageStore.delete(messageStore.keys().next().value);
        }
    }

    if (msg.key.fromMe || !msgText) return;

    // RP: ответом на сообщение пишем «обнять», «пнуть» и т.д.
    const ctx = getContextInfo(content);
    if (ctx && ctx.quotedMessage) {
        const word = msgText.trim().toLowerCase();
        if (Object.hasOwn(rpActions, word)) {
            await delay(400);
            const target = await resolveRpTarget(s, remoteJid, ctx);

            // Кто написал команду — его имя встанет в начало фразы
            const actorJids = await expandJids(s, remoteJid, [
                msg.key.participant, msg.key.participantAlt, msg.key.participantPn, msg.key.senderPn,
                ...(remoteJid.endsWith('@g.us') ? [] : [remoteJid])
            ]);
            const actor = { jids: actorJids, pushName: msg.pushName || '' };

            const rpResult = processRp(word, target, actor);
            if (rpResult) {
                if (rpResult.includes('*участника*')) {
                    console.log('[RP] номер не найден в rp.js:', JSON.stringify(target));
                }
                await s.sendMessage(remoteJid, { text: rpResult }, { quoted: msg });
                return;
            }
        }
    }

    // ---------- отношения ----------
    const lowerText = msgText.trim().toLowerCase();

    // Ответом на сообщение: «подружиться» / «встречаться» / «пожениться»
    if (ctx && ctx.quotedMessage && Object.hasOwn(RELATION_WORDS, lowerText)) {
        const targetInfo = await resolveRpTarget(s, remoteJid, ctx);
        const sender = await resolveSender(s, msg, remoteJid);
        const target = {
            key: personKeyFromJids(targetInfo.jids),
            name: targetInfo.pushName || nameFromJids(targetInfo.jids)
        };
        const text = await relations.propose(RELATION_WORDS[lowerText], sender, target);
        await s.sendMessage(remoteJid, { text }, { quoted: msg });
        return;
    }

    // Ответ на предложение: «принять» / «отказаться»
    const isAccept = ACCEPT_WORDS.has(lowerText);
    const isDecline = DECLINE_WORDS.has(lowerText);
    if (isAccept || isDecline) {
        const sender = await resolveSender(s, msg, remoteJid);
        const text = await relations.respond(sender, isAccept);
        if (text) {
            await s.sendMessage(remoteJid, { text }, { quoted: msg });
            return;
        }
    }

    // Команды: /пара /пары /расстаться /развод /пол
    if (isRelationCommand(msgText)) {
        const sender = await resolveSender(s, msg, remoteJid);
        const text = await relations.handleCommand(msgText, sender);
        if (text) {
            await s.sendMessage(remoteJid, { text }, { quoted: msg });
            return;
        }
    }

    const replyResult = handleIncomingMessage(msgText);
    if (!replyResult) return;

    if (typeof replyResult === 'object' && !Array.isArray(replyResult) && replyResult.type === 'ai') {
        await s.sendMessage(remoteJid, { text: 'Анализирую... :)' }, { quoted: msg });
        await s.sendPresenceUpdate('composing', remoteJid).catch(() => {});
        const aiAnswer = await getAIResponse(s, msg.key.participant || remoteJid, replyResult.query);
        await s.sendPresenceUpdate('paused', remoteJid).catch(() => {});
        await s.sendMessage(remoteJid, { text: aiAnswer }, { quoted: msg });
    } else if (Array.isArray(replyResult)) {
        for (const part of replyResult) {
            await s.sendMessage(remoteJid, { text: part }, { quoted: msg });
            await delay(600);
        }
    } else {
        await s.sendMessage(remoteJid, { text: replyResult }, { quoted: msg });
    }
}

// ---------- запуск ----------
async function startBot() {
    if (!config.databaseUrl) {
        console.error('DATABASE_URL не задан в .env — бот не запущен.');
        return;
    }
    if (starting) return;
    starting = true;

    try {
        const usePostgresAuthState = createPostgresAuth(config.databaseUrl);
        const { state, saveCreds } = await usePostgresAuthState();

        const s = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            logger: pino({ level: 'silent' })
        });
        sock = s;
        connected = false;

        s.ev.on('creds.update', saveCreds);

        s.ev.on('connection.update', async (update) => {
            if (s !== sock) return; // событие от старого сокета
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                connected = true;
                console.log('WhatsApp подключён.');
                await refreshGroups(s);
            }

            if (connection === 'close') {
                connected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('Соединение закрыто, код:', statusCode);

                if (statusCode === DisconnectReason.loggedOut) {
                    // Сессия мертва: чистим её, чтобы бот запросил новый код привязки.
                    console.error('Выход из аккаунта. Сессия очищена, запрашиваю новый код привязки.');
                    try { await clearSession(config.databaseUrl); } catch (e) { console.error(e.message); }
                    scheduleReconnect(5000);
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.error('Сессия открыта в другом месте (конфликт). Повтор через 30 сек.');
                    scheduleReconnect(30000);
                } else {
                    scheduleReconnect(5000);
                }
            }
        });

        s.ev.on('messages.upsert', async (m) => {
            if (s !== sock || m.type !== 'notify') return;
            for (const msg of m.messages) {
                try {
                    await handleMessage(s, msg);
                } catch (err) {
                    console.error('[msg] ошибка обработки:', err.message);
                }
            }
        });

        if (!s.authState.creds.registered && config.pairPhone) {
            const phoneNumber = config.pairPhone.replace(/[^0-9]/g, '');
            await delay(3000);
            try {
                const code = await s.requestPairingCode(phoneNumber);
                console.log(`КОД ПРИВЯЗКИ: ${code}`);
            } catch (err) {
                console.error('Не удалось получить код привязки:', err.message);
            }
        }
    } catch (err) {
        console.error('Ошибка запуска бота:', err.message);
        scheduleReconnect(5000);
    } finally {
        starting = false;
    }
}

startBot();
