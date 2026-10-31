const rpActions = {
    'обнять': 'крепко обнял(-а)',
    'поцеловать': 'нежно поцеловал(-а)',
    'ударить': 'дал(-а) шутливый подзатыльник',
    'погладить': 'погладил(-а) по голове',
    'пнуть': 'легко пнул(-а)',
    'успокоить': 'успокоил(-а) и поддержал(-а)',
    'слить': 'эпично слил(-а)'
};

function cleanAndDeclensionName(rawName) {
    if (!rawName) return 'участника';
    let clean = rawName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '').trim();
    if (!clean) clean = rawName;

    const lower = clean.toLowerCase();
    const map = {
        'feruza': 'Ферузу',
        'феруза': 'Ферузу',
        'b@rsbek': 'Барсбека',
        'барсбек': 'Барсбека',
        'байел': 'Байела',
        'байелбек': 'Байела',
        'адинай': 'Адинай',
        'adinaй': 'Адинай',
        'эмир': 'Эмира',
        'айбике': 'Айбике',
        'айдана': 'Айдану',
        'айзерек': 'Айзерек',
        'сауле': 'Сауле',
        'сезим': 'Сезим',
        'чынгыз': 'Чынгыза',
        'амина': 'Амину',
        'раяна': 'Раяну'
    };

    if (map[lower]) return map[lower];

    if (/[ая]$/i.test(clean)) {
        return clean.replace(/[ая]$/i, m => m.toLowerCase() === 'а' ? 'у' : 'ю');
    }
    if (!/[еёиоуыэюя]$/i.test(clean)) {
        return clean + 'а';
    }

    return clean;
}

function processRp(text, senderName, targetRawName) {
    const cleanText = text.trim().toLowerCase();
    if (!rpActions[cleanText]) return null;

    const actionText = rpActions[cleanText];
    
    let senderClean = senderName ? senderName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '').trim() : 'Kaguya';
    if (!senderClean || senderClean.toLowerCase().includes('kaguya')) {
        senderClean = 'Kaguya';
    }

    const targetClean = cleanAndDeclensionName(targetRawName);

    return `✨ *${senderClean}* ${actionText} *${targetClean}*!`;
}

module.exports = { rpActions, processRp };
