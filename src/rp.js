const rpActions = {
    'обнять': 'крепко обнял(-а)',
    'поцеловать': 'нежно поцеловал(-а)',
    'ударить': 'дал(-а) шутливый подзатыльник',
    'погладить': 'погладил(-а) по голове',
    'пнуть': 'легко пнул(-а)',
    'успокоить': 'успокоил(-а) и поддержал(-а)',
    'слить': 'эпично слил(-а)'
};

const phoneToName = {
    '707664465': 'Ферузу',
    '707398640': 'Барсбека',
    '500102767': 'Айбике',
    '555881285': 'Айдану',
    '507901211': 'Айдеми',
    '708837769': 'Айзирек',
    '995809058': 'Баямана',
    '707360912': 'Гулсун',
    '702785656': 'Динислама',
    '501758481': 'Жаныл',
    '500690001': 'Куту',
    '700458926': 'Эмира',
    '702367712': 'Надиху',
    '503070911': 'Нурислама',
    '500475118': 'Байела',
    '707329247': 'Раяну',
    '703232059': 'Сауле',
    '224240139': 'Сезим',
    '755854855': 'Тилекова',
    '999854855': 'Тилекова',
    '708110826': 'Альбину',
    '508502012': 'Элину',
    '507086408': 'Амину',
    '702110530': 'Адинай',
    '504257960': 'Амину',
    '709717643': 'Саиду',
    '509123247': 'Чынгыза',
    '226035271': 'Байела',
    '556214091': 'Kaguya'
};

function resolveTargetName(participantJid, quotedText, rawName) {
    const searchStrings = [participantJid, quotedText, rawName].filter(Boolean);

    for (const str of searchStrings) {
        const cleanStr = String(str);
        const cleanNum = cleanStr.replace(/[^0-9]/g, '');
        
        for (const [phone, name] of Object.entries(phoneToName)) {
            if (cleanNum && cleanNum.includes(phone)) {
                return name;
            }
        }

        const lowerStr = cleanStr.toLowerCase();
        const map = {
            'мбанк': 'Эмира',
            'mbank': 'Эмира',
            'палчик': 'Байела',
            'барсик': 'Барсбека',
            'barsik': 'Барсбека',
            'feruza': 'Ферузу',
            'феруза': 'Ферузу',
            'b@rsbek': 'Барсбека',
            'барсбек': 'Барсбека',
            'байел': 'Байела',
            'адинай': 'Адинай',
            'adinaй': 'Адинай',
            'эмир': 'Эмира',
            'айбике': 'Айбике',
            'айдана': 'Айдану',
            'айзерек': 'Айзирек',
            'сауле': 'Сауле',
            'сезим': 'Сезим',
            'чынгыз': 'Чынгыза',
            'амина': 'Амину',
            'раяна': 'Раяну'
        };

        for (const [key, name] of Object.entries(map)) {
            if (lowerStr.includes(key)) {
                return name;
            }
        }
    }

    if (rawName && rawName !== 'участника') {
        let clean = rawName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '').trim();
        if (clean) return clean;
    }

    return 'участника';
}

function processRp(text, senderName, participantJid, quotedText, rawName) {
    const cleanText = text.trim().toLowerCase();
    if (!rpActions[cleanText]) return null;

    const actionText = rpActions[cleanText];
    const senderClean = 'Kaguya';
    const targetClean = resolveTargetName(participantJid, quotedText, rawName);

    return `*${senderClean}* ${actionText} *${targetClean}*! :)`;
}

module.exports = { rpActions, processRp };
