const rpActions = {
    'обнять': 'крепко обнял(-а)',
    'поцеловать': 'нежно поцеловал(-а)',
    'ударить': 'дал(-а) шутливый подзатыльник',
    'погладить': 'погладил(-а) по голове',
    'пнуть': 'легко пнул(-а)',
    'успокоить': 'успокоил(-а) и поддержал(-а)',
    'слить': 'эпично слил(-а)'
};

// Дополнительные действия. {acc} — кого, {dat} — кому, {ins} — с кем (имя склоняется само).
Object.assign(rpActions, {
    'обнять дружески': 'по-дружески обнял(-а) {acc}',
    'кусь': 'легонько укусил(-а) {acc}',
    'хрусь': 'схрумкал(-а) {acc}',
    'пощекотать': 'пощекотал(-а) {acc}',
    'погладить по голове': 'погладил(-а) {acc} по голове',
    'подмигнуть': 'подмигнул(-а) {dat}',
    'флиртовать': 'зафлиртовал(-а) с {ins}',
    'прижать': 'крепко прижал(-а) к себе {acc}',
    'шлеп': 'шлёпнул(-а) {acc}',
    'щелбан': 'дал(-а) щелбан {dat}',
    'подзатыльник': 'отвесил(-а) подзатыльник {dat}',
    'пощечина': 'дал(-а) пощёчину {dat}',
    'толкнуть': 'толкнул(-а) {acc}',
    'швырнуть': 'швырнул(-а) {acc}',
    'вмазать': 'вмазал(-а) {dat}',
    'втащить': 'втащил(-а) {dat}',
    'заехать': 'с размаху заехал(-а) {dat}',
    'пожать руку': 'пожал(-а) руку {dat}',
    'похлопать': 'похлопал(-а) {acc} по плечу',
    'дать пять': 'дал(-а) пять {dat}',
    'поклониться': 'низко поклонился(-ась) {dat}',
    'помахать': 'помахал(-а) {dat}',
    'кивнуть': 'кивнул(-а) {dat}',
    'показать язык': 'показал(-а) язык {dat}',
    'подбодрить': 'подбодрил(-а) {acc}',
    'аплодировать': 'зааплодировал(-а) {dat}'
});

// База номеров (поддерживает и 996, и +996, и без кода страны)
const phoneToName = {
    '996707664465': 'Ферузу', '707664465': 'Ферузу',
    '996707398640': 'Барсбека', '707398640': 'Барсбека',
    '996500102767': 'Айбике', '500102767': 'Айбике',
    '996555881285': 'Айдану', '555881285': 'Айдану',
    '996507901211': 'Айдеми', '507901211': 'Айдеми',
    '996708837769': 'Айзирек', '708837769': 'Айзирек',
    '996995809058': 'Баямана', '995809058': 'Баямана',
    '996707360912': 'Гулсун', '707360912': 'Гулсун',
    '996702785656': 'Динислама', '702785656': 'Динислама',
    '996501758481': 'Жаныл', '501758481': 'Жаныл',
    '996500690001': 'Куту', '500690001': 'Куту',
    '996700458926': 'Эмира', '700458926': 'Эмира',
    '996702367712': 'Надиху', '702367712': 'Надиху',
    '996503070911': 'Нурислама', '503070911': 'Нурислама',
    '996500475118': 'Байела', '500475118': 'Байела',
    '996707329247': 'Раяну', '707329247': 'Раяну',
    '996703232059': 'Сауле', '703232059': 'Сауле',
    '996224240139': 'Сезим', '224240139': 'Сезим',
    '996755854855': 'Тилекова', '755854855': 'Тилекова',
    '996999854855': 'Тилекова', '999854855': 'Тилекова',
    '996708110826': 'Альбину', '708110826': 'Альбину',
    '996508502012': 'Элину', '508502012': 'Элину',
    '996507086408': 'Амину', '507086408': 'Амину',
    '996702110530': 'Адинай', '702110530': 'Адинай',
    '996504257960': 'Амину', '504257960': 'Амину',
    '996709717643': 'Саиду', '709717643': 'Саиду',
    '996509123247': 'Чынгыза', '509123247': 'Чынгыза',
    '996226035271': 'Байела', '226035271': 'Байела',
    '996556214091': 'Kaguya', '556214091': 'Kaguya'
};

// Индекс: последние 9 цифр номера -> имя (в винительном падеже).
// Так совпадут и 996707664465, и +996 707 664 465, и 707664465.
const phoneIndex = new Map();
for (const [phone, name] of Object.entries(phoneToName)) {
    phoneIndex.set(phone.replace(/\D/g, '').slice(-9), name);
}

// Ники — только ТОЧНОЕ совпадение целого слова из имени в WhatsApp (не подстрока).
const nicknameMap = {
    'мбанк': 'Эмира', 'mbank': 'Эмира',
    'палчик': 'Байела',
    'барсик': 'Барсбека', 'barsik': 'Барсбека', 'b@rsbek': 'Барсбека', 'барсбек': 'Барсбека',
    'feruza': 'Ферузу', 'феруза': 'Ферузу',
    'байел': 'Байела',
    'надиха': 'Надиху', 'надих': 'Надиху',
    'адинай': 'Адинай', 'adinai': 'Адинай',
    'эмир': 'Эмира',
    'айбике': 'Айбике', 'айбийке': 'Айбике',
    'айдана': 'Айдану',
    'айзирек': 'Айзирек', 'айзерек': 'Айзирек',
    'сауле': 'Сауле',
    'сезим': 'Сезим',
    'чынгыз': 'Чынгыза',
    'раяна': 'Раяну'
    // 'амина' намеренно нет: в классе две Амины, по нику не различить — только по номеру
};

// Номер берём только из настоящих номерных JID (@s.whatsapp.net / @c.us).
// @lid — это НЕ номер, цифры в нём случайные.
function phoneFromJid(jid) {
    if (typeof jid !== 'string') return null;
    const [user, server] = jid.split('@');
    if (server && server !== 's.whatsapp.net' && server !== 'c.us') return null;
    const digits = user.split(':')[0].replace(/\D/g, '');
    return digits.length >= 9 ? digits : null;
}

function nameByJid(jid) {
    const digits = phoneFromJid(jid);
    return digits ? (phoneIndex.get(digits.slice(-9)) || null) : null;
}

function declineName(rawName) {
    const firstWord = String(rawName || '').replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, ' ').trim().split(/\s+/)[0];
    if (!firstWord) return null;
    if (/[ая]$/i.test(firstWord)) {
        return firstWord.replace(/[ая]$/i, m => (m.toLowerCase() === 'а' ? 'у' : 'ю'));
    }
    return firstWord;
}

/**
 * target = { jids: string[], pushName: string }
 * 1) по номеру из любого JID  2) по нику (целое слово)  3) по имени из WhatsApp  4) 'участника'
 */
function resolveTargetName(target = {}) {
    const jids = Array.isArray(target.jids) ? target.jids : [];
    for (const jid of jids) {
        const name = nameByJid(jid);
        if (name) return name;
    }

    const pushName = String(target.pushName || '');
    const tokens = pushName.toLowerCase().split(/[^\p{L}\p{N}@]+/u).filter(Boolean);
    for (const token of tokens) {
        if (Object.hasOwn(nicknameMap, token)) return nicknameMap[token];
    }

    return declineName(pushName) || 'участника';
}

// Имя в таблице хранится в винительном падеже («Ферузу», «Эмира»). Делаем дательный и творительный.
const indeclinable = new Set(['куту', 'kaguya']);

function inflect(accName, kase) {
    if (!accName || kase === 'acc') return accName;
    if (indeclinable.has(accName.toLowerCase())) return accName;

    const last = accName.slice(-1).toLowerCase();
    const stem = accName.slice(0, -1);

    if (last === 'у') return stem + (kase === 'dat' ? 'е' : 'ой');   // Ферузу -> Ферузе / Ферузой
    if (last === 'ю') {                                               // Васю -> Васе / Васей, Марию -> Марии
        if (kase === 'dat') return /и$/i.test(stem) ? stem + 'и' : stem + 'е';
        return stem + 'ей';
    }
    if (last === 'а') {                                               // Эмира -> Эмиру / Эмиром
        if (kase === 'dat') return stem + 'у';
        return /(ов|ев|ин)$/i.test(stem) ? stem + 'ым' : stem + 'ом'; // Тилекова -> Тилековым
    }
    return accName; // Айбике, Сауле, Адинай, Айзирек... не склоняются
}

function buildAction(actionText, targetName) {
    if (!/\{(acc|dat|ins)\}/.test(actionText)) {
        return `${actionText} *${targetName}*`; // старый формат: «кто действие кого»
    }
    return actionText.replace(/\{(acc|dat|ins)\}/g, (_, kase) => `*${inflect(targetName, kase)}*`);
}

function processRp(text, target) {
    const cleanText = String(text || '').trim().toLowerCase();
    if (!Object.hasOwn(rpActions, cleanText)) return null;

    const targetName = resolveTargetName(target);
    return `*Kaguya* ${buildAction(rpActions[cleanText], targetName)}! :)`;
}

// Постоянный ключ человека: последние 9 цифр номера (если номер известен), иначе сам JID (@lid).
function personKeyFromJids(jids) {
    const list = Array.isArray(jids) ? jids : [];
    for (const jid of list) {
        const digits = phoneFromJid(jid);
        if (digits) return digits.slice(-9);
    }
    const first = list.find(j => typeof j === 'string' && j.includes('@'));
    return first ? first.replace(/:\d+@/, '@') : null;
}

module.exports = { rpActions, processRp, resolveTargetName, personKeyFromJids, nameByJid };
