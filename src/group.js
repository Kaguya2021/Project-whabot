// Групповая активность, ранги/XP, дуэли и список RP-действий.
// Хранится в PostgreSQL bot_state (ключ 'group_stats'), как и relations.js.

const { rpActions } = require('./rp');

const XP_COOLDOWN_MS = 3000;
const DUEL_COOLDOWN_MS = 20000;
const SAVE_DEBOUNCE_MS = 10000;

const RANKS = [
    { minXp: 0, title: '🌱 Новичок' },
    { minXp: 100, title: '⚡ Свой чел' },
    { minXp: 300, title: '🔥 Активист' },
    { minXp: 700, title: '💎 Авторитет' },
    { minXp: 1500, title: '👑 Легенда 9-В' },
    { minXp: 3000, title: '🌌 Император чата' }
];

const DUEL_SCENES = [
    '⚔️ *{win}* сделал(-а) идеальный уворот и вынес(-ла) *{lose}* одним чётким ударом!',
    '🔥 *{win}* призвал(-а) силу алгебры и отправил(-а) *{lose}* в нокаут!',
    '⚡ *{win}* оказался(-лась) быстрее — *{lose}* даже не успел(-а) моргнуть!',
    '🎯 *{win}* снёс(-ла) *{lose}* в сухую! Толпа в шоке!',
    '💥 *{lose}* поскользнулся(-лась) на банановой кожуре, и *{win}* забрал(-а) лёгкую победу!'
];

const COMMANDS = new Set([
    '/топ', '/актив',
    '/стата', '/я', '/ранг',
    '/дуэль',
    '/rp', '/рп',
    '/все', '/all'
]);

function todayKey() {
    return new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
}

function getRank(xp) {
    let current = RANKS[0];
    for (const r of RANKS) {
        if (xp >= r.minXp) current = r;
    }
    const level = Math.floor(Math.sqrt(xp / 25)) + 1;
    return { title: current.title, level };
}

function formatRpList() {
    const words = Object.keys(rpActions);
    const half = Math.ceil(words.length / 2);
    const col1 = words.slice(0, half).map(w => `• ${w}`).join('\n');
    const col2 = words.slice(half).map(w => `• ${w}`).join('\n');
    return (
        `🎭 *RP-действия* (ответь на сообщение нужным словом):\n\n` +
        `${col1}\n${col2}\n\n` +
        `💞 *Отношения* (ответом на сообщение):\n` +
        `• подружиться • встречаться • пожениться\n` +
        `• принять / отказаться`
    );
}

function createGroupStats(store) {
    let state = null;
    let chain = Promise.resolve();
    let saveTimer = null;
    const lastXpAt = new Map();
    const lastDuelAt = new Map();

    async function load() {
        if (state) return;
        state = { groups: {} };
        try {
            const raw = await store.load();
            if (raw) {
                const parsed = JSON.parse(raw);
                state = { groups: parsed.groups || {} };
            }
        } catch (err) {
            console.error('[group] не удалось загрузить статистику:', err.message);
        }
    }

    async function flushSave() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        try {
            await store.save(JSON.stringify(state));
        } catch (err) {
            console.error('[group] не удалось сохранить статистику:', err.message);
        }
    }

    function scheduleSave() {
        if (saveTimer) return;
        saveTimer = setTimeout(() => {
            saveTimer = null;
            flushSave().catch(() => {});
        }, SAVE_DEBOUNCE_MS);
    }

    function run(fn) {
        const next = chain.then(async () => {
            await load();
            return fn();
        });
        chain = next.catch(() => {});
        return next;
    }

    function ensureUser(groupJid, person) {
        const g = state.groups[groupJid] || (state.groups[groupJid] = {});
        const u = g[person.key] || (g[person.key] = {
            name: person.name || 'Участник',
            messages: 0,
            todayCount: 0,
            todayDate: todayKey(),
            xp: 0,
            duelWins: 0,
            duelLosses: 0
        });
        if (person.name) u.name = person.name;
        const today = todayKey();
        if (u.todayDate !== today) {
            u.todayDate = today;
            u.todayCount = 0;
        }
        return u;
    }

    // Учитываем каждое сообщение в группе (тихо, без спама)
    function recordMessage(groupJid, person) {
        if (!groupJid || !person || !person.key) return Promise.resolve();
        const cooldownKey = `${groupJid}|${person.key}`;
        const now = Date.now();
        const gainXp = now - (lastXpAt.get(cooldownKey) || 0) >= XP_COOLDOWN_MS;
        if (gainXp) lastXpAt.set(cooldownKey, now);

        return run(() => {
            const u = ensureUser(groupJid, person);
            u.messages += 1;
            u.todayCount += 1;
            if (gainXp) u.xp += 5 + Math.floor(Math.random() * 6); // 5–10 XP
            scheduleSave();
        });
    }

    function getTop(groupJid, limit = 10) {
        return run(() => {
            const g = state.groups[groupJid] || {};
            const today = todayKey();
            const list = Object.values(g)
                .filter(u => u.messages > 0)
                .sort((a, b) => b.xp - a.xp || b.messages - a.messages)
                .slice(0, limit);

            if (list.length === 0) {
                return '📊 Статистика группы пока пустая — пишите в чат, чтобы попасть в топ!';
            }

            const medals = ['🥇', '🥈', '🥉'];
            const lines = ['🏆 *Топ актива группы:*', ''];
            list.forEach((u, i) => {
                const prefix = medals[i] || `${i + 1}.`;
                const { level } = getRank(u.xp);
                const todayMsg = u.todayDate === today ? u.todayCount : 0;
                lines.push(`${prefix} *${u.name}* — ${u.messages} сообщ. (сегодня ${todayMsg}) • Lv.${level}`);
            });
            return lines.join('\n');
        });
    }

    function getProfile(groupJid, person) {
        return run(() => {
            if (!person || !person.key) return 'Не удалось определить твой профиль 😕';
            const u = ensureUser(groupJid, person);
            const { title, level } = getRank(u.xp);
            const totalDuels = u.duelWins + u.duelLosses;
            const duelLine = totalDuels > 0
                ? `⚔️ Дуэли: *${u.duelWins}W / ${u.duelLosses}L*`
                : '⚔️ Дуэли: ещё не играл(а) (ответь на сообщение: `/дуэль`)';

            return (
                `📊 *Профиль: ${u.name}*\n\n` +
                `🏅 Ранг: *${title}* (Lv.${level})\n` +
                `✨ Опыт: *${u.xp} XP*\n` +
                `💬 Сообщений: *${u.messages}* (сегодня: *${u.todayCount}*)\n` +
                duelLine
            );
        });
    }

    function runDuel(groupJid, actor, target) {
        return run(async () => {
            if (!actor || !actor.key || !target || !target.key) {
                return '⚔️ Чтобы вызвать на дуэль, ответь на сообщение соперника командой `/дуэль`!';
            }
            if (actor.key === target.key) {
                return '😅 Сам с собой драться нельзя, выбери соперника!';
            }

            const now = Date.now();
            const last = lastDuelAt.get(actor.key) || 0;
            if (now - last < DUEL_COOLDOWN_MS) {
                const wait = Math.ceil((DUEL_COOLDOWN_MS - (now - last)) / 1000);
                return `⏳ Передохни после прошлой дуэли (${wait} сек.)`;
            }
            lastDuelAt.set(actor.key, now);

            const ua = ensureUser(groupJid, actor);
            const ut = ensureUser(groupJid, target);

            const actorWins = Math.random() < 0.5;
            const winner = actorWins ? ua : ut;
            const loser = actorWins ? ut : ua;

            winner.duelWins += 1;
            winner.xp += 25;
            loser.duelLosses += 1;
            loser.xp += 5;

            await flushSave();

            const scene = DUEL_SCENES[Math.floor(Math.random() * DUEL_SCENES.length)]
                .replace('{win}', winner.name)
                .replace('{lose}', loser.name);

            return `${scene}\n\n🏆 *${winner.name}* получает *+25 XP* (побед: ${winner.duelWins})`;
        });
    }

    return { recordMessage, getTop, getProfile, runDuel, flushSave };
}

function isGroupCommand(text) {
    const cmd = String(text || '').trim().split(/\s+/)[0].toLowerCase();
    return COMMANDS.has(cmd);
}

module.exports = { createGroupStats, isGroupCommand, formatRpList };
