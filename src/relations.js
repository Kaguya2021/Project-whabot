// Отношения: друзья, пара, брак. Всё подтверждается согласием второго человека.
// Данные лежат одним JSON в таблице bot_state (ключ 'relations').

const PENDING_TTL_MS = 24 * 60 * 60 * 1000; // предложение действует сутки

// Слова-ответы на сообщение человека (reply)
const RELATION_WORDS = {
    'подружиться': 'friend',
    'встречаться': 'couple',
    'пожениться': 'married'
};

// Ответ на предложение (обычным сообщением)
const ACCEPT_WORDS = new Set(['принять', '/принять']);
const DECLINE_WORDS = new Set(['отказаться', '/отказаться', 'отказать']);

const COMMANDS = new Set(['/пара', '/отношения', '/профиль', '/пары', '/расстаться', '/развод', '/пол']);

function pairId(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function createRelations(store) {
    let state = null;
    let chain = Promise.resolve();

    async function load() {
        if (state) return;
        state = { profiles: {}, rels: {}, pending: {} };
        try {
            const raw = await store.load();
            if (raw) {
                const p = JSON.parse(raw);
                state = { profiles: p.profiles || {}, rels: p.rels || {}, pending: p.pending || {} };
            }
        } catch (err) {
            console.error('[relations] не удалось загрузить данные:', err.message);
        }
    }

    async function save() {
        try {
            await store.save(JSON.stringify(state));
        } catch (err) {
            console.error('[relations] не удалось сохранить данные:', err.message);
        }
    }

    // Все операции выполняются строго по очереди, чтобы данные не затирали друг друга.
    function run(fn) {
        const next = chain.then(async () => {
            await load();
            return fn();
        });
        chain = next.catch(() => {});
        return next;
    }

    // ---------- помощники (вызывать только внутри run) ----------
    const nameOf = (key) => (state.profiles[key] && state.profiles[key].name) || 'Игрок';
    const genderOf = (key) => (state.profiles[key] && state.profiles[key].gender) || null;

    function touch(person) {
        if (!person || !person.key) return;
        const p = state.profiles[person.key] || (state.profiles[person.key] = {});
        if (person.name) p.name = person.name;
    }

    const relBetween = (a, b) => state.rels[pairId(a, b)] || null;

    // Текущая пара/супруг(а) человека (дружба не считается)
    function partnerOf(key) {
        for (const [id, rel] of Object.entries(state.rels)) {
            if (rel.type === 'friend') continue;
            const [x, y] = id.split('|');
            if (x === key) return { key: y, rel };
            if (y === key) return { key: x, rel };
        }
        return null;
    }

    function friendsOf(key) {
        const result = [];
        for (const [id, rel] of Object.entries(state.rels)) {
            if (rel.type !== 'friend') continue;
            const [x, y] = id.split('|');
            if (x === key) result.push(y);
            else if (y === key) result.push(x);
        }
        return result;
    }

    function daysSince(iso) {
        const ms = Date.now() - new Date(iso).getTime();
        return Math.max(0, Math.floor(ms / 86400000));
    }

    function roleWord(partnerKey, type) {
        const g = genderOf(partnerKey);
        if (type === 'married') return g === 'ж' ? 'жена' : g === 'м' ? 'муж' : 'супруг(а)';
        return g === 'ж' ? 'девушка' : g === 'м' ? 'парень' : 'пара';
    }

    function validate(kind, a, b) {
        const existing = relBetween(a, b);

        if (kind === 'friend') {
            if (!existing) return null;
            return existing.type === 'friend' ? 'Вы уже друзья 🤝' : 'Вы уже ближе, чем друзья 😉';
        }

        if (kind === 'couple') {
            if (existing && existing.type === 'married') return 'Вы уже в браке 💍';
            if (existing && existing.type === 'couple') return 'Вы уже встречаетесь 💞';
            const pa = partnerOf(a);
            if (pa) return `*${nameOf(a)}* уже в отношениях с *${nameOf(pa.key)}* 💔`;
            const pb = partnerOf(b);
            if (pb) return `*${nameOf(b)}* уже в отношениях с *${nameOf(pb.key)}* 💔`;
            return null;
        }

        if (kind === 'married') {
            if (!existing || existing.type === 'friend') {
                return 'Сначала нужно начать встречаться (ответом на сообщение: *встречаться*) 💞';
            }
            if (existing.type === 'married') return 'Вы уже в браке 💍';
            return null;
        }

        return 'Неизвестное действие';
    }

    function isFresh(pending) {
        return pending && Date.now() - pending.at < PENDING_TTL_MS;
    }

    // ---------- публичные операции ----------

    // from, to = { key, name }
    function propose(kind, from, to) {
        return run(async () => {
            if (!from || !from.key || !to || !to.key) return 'Не удалось определить человека 😕';
            touch(from);
            touch(to);

            if (from.key === to.key) {
                await save();
                return 'Нельзя сделать это с самим собой 😅';
            }

            const err = validate(kind, from.key, to.key);
            if (err) {
                await save();
                return err;
            }

            const current = state.pending[to.key];
            if (isFresh(current)) {
                await save();
                return `У *${nameOf(to.key)}* уже есть неотвеченное предложение ⏳`;
            }

            state.pending[to.key] = { from: from.key, kind, at: Date.now() };
            await save();

            const a = nameOf(from.key);
            const b = nameOf(to.key);
            const tail = `\n\n*${b}*, напиши *принять* или *отказаться* (действует 24 часа).`;
            if (kind === 'friend') return `🤝 *${a}* предлагает *${b}* дружбу!${tail}`;
            if (kind === 'couple') return `💞 *${a}* предлагает *${b}* начать встречаться!${tail}`;
            return `💍 *${a}* делает предложение *${b}*: пожениться!${tail}`;
        });
    }

    // person = { key, name }. Возвращает текст или null (если предложений для него нет).
    function respond(person, accept) {
        return run(async () => {
            if (!person || !person.key) return null;
            const pending = state.pending[person.key];
            if (!pending) return null;

            if (!isFresh(pending)) {
                delete state.pending[person.key];
                await save();
                return null;
            }

            touch(person);
            delete state.pending[person.key];

            const a = nameOf(pending.from);
            const b = nameOf(person.key);

            if (!accept) {
                await save();
                return `💔 *${b}* отказал(-а) *${a}*.`;
            }

            const err = validate(pending.kind, pending.from, person.key);
            if (err) {
                await save();
                return `😕 Не получилось: ${err}`;
            }

            state.rels[pairId(pending.from, person.key)] = {
                type: pending.kind,
                since: new Date().toISOString()
            };
            await save();

            if (pending.kind === 'friend') return `🤝 *${a}* и *${b}* теперь друзья!`;
            if (pending.kind === 'couple') return `💞 *${a}* и *${b}* теперь встречаются! Совет да любовь ✨`;

            const ga = genderOf(pending.from);
            const gb = genderOf(person.key);
            if (ga === 'м' && gb === 'ж') return `💍 *${a}* и *${b}* теперь муж и жена! Горько! 🥂`;
            if (ga === 'ж' && gb === 'м') return `💍 *${b}* и *${a}* теперь муж и жена! Горько! 🥂`;
            return `💍 *${a}* и *${b}* теперь супруги! Горько! 🥂`;
        });
    }

    function setGender(person, arg) {
        return run(async () => {
            if (!person || !person.key) return 'Не удалось определить тебя 😕';
            const v = String(arg || '').trim().toLowerCase();
            let gender = null;
            if (/^(м|муж|парень|мальчик)/.test(v)) gender = 'м';
            else if (/^(ж|жен|девушка|девочка)/.test(v)) gender = 'ж';

            if (!gender) return 'Напиши так: */пол м* или */пол ж*';

            touch(person);
            state.profiles[person.key].gender = gender;
            await save();
            return gender === 'м'
                ? '✅ Записал: ты парень (в браке будешь «муж»).'
                : '✅ Записал: ты девушка (в браке будешь «жена»).';
        });
    }

    function status(person) {
        return run(async () => {
            if (!person || !person.key) return 'Не удалось определить тебя 😕';
            touch(person);
            await save();

            const key = person.key;
            const lines = [`👤 *${nameOf(key)}*`];

            const g = genderOf(key);
            if (g) lines.push(g === 'м' ? '🚹 Пол: парень' : '🚺 Пол: девушка');

            const partner = partnerOf(key);
            if (partner) {
                const d = daysSince(partner.rel.since);
                if (partner.rel.type === 'married') {
                    lines.push(`💍 В браке с *${nameOf(partner.key)}* (${roleWord(partner.key, 'married')}) — ${d} дн.`);
                } else {
                    lines.push(`💞 Встречается с *${nameOf(partner.key)}* (${roleWord(partner.key, 'couple')}) — ${d} дн.`);
                }
            }

            const friends = friendsOf(key);
            if (friends.length) {
                lines.push(`🤝 Друзья (${friends.length}): ${friends.map(nameOf).join(', ')}`);
            }

            if (!partner && friends.length === 0) {
                lines.push('Пока нет ни друзей, ни пары.');
                lines.push('Ответь на чьё-то сообщение словом *подружиться* или *встречаться* 😉');
            }
            if (!g) lines.push('\nЧтобы в браке было «муж/жена»: */пол м* или */пол ж*');

            return lines.join('\n');
        });
    }

    function breakUp(person) {
        return run(async () => {
            if (!person || !person.key) return 'Не удалось определить тебя 😕';
            const partner = partnerOf(person.key);
            if (!partner) return 'У тебя сейчас нет пары 🤷';

            const a = nameOf(person.key);
            const b = nameOf(partner.key);
            const wasMarried = partner.rel.type === 'married';
            delete state.rels[pairId(person.key, partner.key)];
            await save();

            return wasMarried
                ? `💔 *${a}* и *${b}* развелись.`
                : `💔 *${a}* и *${b}* расстались.`;
        });
    }

    function listPairs() {
        return run(async () => {
            const pairs = Object.entries(state.rels)
                .filter(([, rel]) => rel.type !== 'friend')
                .sort((x, y) => new Date(x[1].since) - new Date(y[1].since))
                .slice(0, 25);

            if (pairs.length === 0) return '💞 Пока нет ни одной пары. Будь первым!';

            const lines = ['💞 *Пары класса*', ''];
            for (const [id, rel] of pairs) {
                const [x, y] = id.split('|');
                const icon = rel.type === 'married' ? '💍' : '💞';
                lines.push(`${icon} ${nameOf(x)} + ${nameOf(y)} — ${daysSince(rel.since)} дн.`);
            }
            return lines.join('\n');
        });
    }

    // Текстовые команды. Возвращает текст или null, если это не команда отношений.
    function handleCommand(text, person) {
        const parts = String(text || '').trim().split(/\s+/);
        const cmd = (parts[0] || '').toLowerCase();
        if (!COMMANDS.has(cmd)) return Promise.resolve(null);

        if (cmd === '/пара' || cmd === '/отношения' || cmd === '/профиль') return status(person);
        if (cmd === '/пары') return listPairs();
        if (cmd === '/расстаться' || cmd === '/развод') return breakUp(person);
        if (cmd === '/пол') return setGender(person, parts[1]);
        return Promise.resolve(null);
    }

    return { propose, respond, handleCommand, status, breakUp, listPairs, setGender };
}

function isRelationCommand(text) {
    const cmd = String(text || '').trim().split(/\s+/)[0].toLowerCase();
    return COMMANDS.has(cmd);
}

module.exports = { createRelations, isRelationCommand, RELATION_WORDS, ACCEPT_WORDS, DECLINE_WORDS };
