const {
    formatDaySchedule,
    formatTodaySchedule,
    formatTomorrowSchedule,
    getCurrentLessonStatus,
    getFullScheduleMenu
} = require('./schedule');
const {
    getPeopleList,
    getBirthdayList,
    getUpcomingBirthdays,
    getBirthdayGreeting
} = require('./people');
const { INTRO: AI_INTRO } = require('./ai');
const {
    getBananaResponse,
    getNewsResponse,
    getPalcResponse,
    getRandomBaranFact,
    getKaguyaFortune,
    getMagicBallResponse,
    getProbabilityResponse,
    getChoiceResponse,
    getWhoResponse,
    getShipResponse
} = require('./fun');
const { formatRpList } = require('./group');

// Вопрос про создателя бота («кто тебя создал?») — отвечаем готовым текстом, без обращения к ИИ.
function isCreatorQuestion(query) {
    const q = query.toLowerCase();
    const who = /(кто|кем|чей|who)/.test(q);
    const made = /(создал|создан|сделал|сделан|разработал|разработан|написал|написан|придумал|создател|разработчик|creat|made|built|develop)/.test(q);
    const aboutBot = /(тебя|тебе|тобой|ты|твой|твоя|твои|бота|вас|kaguya|кагуя|кагуйя|\byou\b)/.test(q);
    return who && made && aboutBot;
}

// Естественное обращение без слеша: «кагуя ...», «kaguya ...», «ии ...»
function extractNaturalAiQuery(text) {
    const m = text.match(/^(?:кагуя|kaguya|ии|гемини|gemini)[,:\s]+([\s\S]+)$/i);
    return m ? m[1].trim() : null;
}

function handleIncomingMessage(text) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return null;

    // 1. Обращение к ИИ без слеша: «кагуя объясни закон Ома»
    if (!cleanText.startsWith('/')) {
        const naturalQuery = extractNaturalAiQuery(cleanText);
        if (naturalQuery) {
            if (isCreatorQuestion(naturalQuery)) return AI_INTRO;
            return { type: 'ai', query: naturalQuery };
        }
        return null;
    }

    const parts = cleanText.split(/\s+/);
    const command = parts[0].toLowerCase();
    const targetParam = parts.slice(1).join(' ');

    switch (command) {
        // ---------- Школа и расписание ----------
        case '/сегодня':
            return formatTodaySchedule();

        case '/завтра':
            return formatTomorrowSchedule();

        case '/урок':
        case '/сейчас':
            return getCurrentLessonStatus();

        case '/понедельник':
            return formatDaySchedule('monday');

        case '/вторник':
            return formatDaySchedule('tuesday');

        case '/среда':
            return formatDaySchedule('wednesday');

        case '/четверг':
            return formatDaySchedule('thursday');

        case '/пятница':
            return formatDaySchedule('friday');

        case '/расписание':
            return getFullScheduleMenu();

        case '/люди':
            return getPeopleList();

        case '/dr':
            return getBirthdayList();

        case '/ближайшийдр':
        case '/скородр':
            return getUpcomingBirthdays(3);

        case '/grr':
            return getBirthdayGreeting(targetParam) || 'Укажите имя ученика, например: /grr Эмир';

        // ---------- Gemini AI ----------
        case '/ai':
        case '/ии':
        case '/gemini':
            if (!targetParam) return AI_INTRO;
            if (isCreatorQuestion(targetParam)) return AI_INTRO;
            return { type: 'ai', query: targetParam };

        case '/сброс':
            return { type: 'ai', query: 'сброс' };

        // ---------- Группа, игры и фан ----------
        case '/rp':
        case '/рп':
            return formatRpList();

        case '/шар':
            return getMagicBallResponse(targetParam);

        case '/инфа':
        case '/шанс':
            return getProbabilityResponse(targetParam);

        case '/выбери':
            return getChoiceResponse(targetParam);

        case '/кто':
            return getWhoResponse(targetParam);

        case '/шип':
        case '/совместимость':
            return getShipResponse(targetParam);

        case '/цитата':
        case '/предсказание':
            return getKaguyaFortune();

        case '/banana':
            return getBananaResponse(targetParam);

        case '/news':
            return getNewsResponse(targetParam);

        case '/palc':
            return getPalcResponse();

        case '/baran':
            return getRandomBaranFact();

        // ---------- Инфо ----------
        case '/создатель':
            return `╭━━━━━━━━━━━━━━━━━━━━╮\n` +
                   `✦ 𝐂𝐑𝐄𝐀𝐓𝐎𝐑 𝐈𝐍𝐅𝐎 ✦\n` +
                   `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                   `👑 *Создатель:* Kaguya\n` +
                   `💻 *Разработчик:* Kaguya\n` +
                   `⚡ *Автор проекта:* Kaguya\n\n` +
                   `╭─────── SOCIAL MEDIA ───────╮\n\n` +
                   `✈️ *Telegram:* @kaguya2_0\n` +
                   `🔗 https://t.me/kaguya2_0\n\n` +
                   `💬 *WhatsApp:* Связаться со мной\n` +
                   `🔗 https://wa.me/996700214091\n\n` +
                   `╰──────────────────────────╯\n\n` +
                   `🛠️ Разработка • Обновления • Новые проекты\n\n` +
                   `♥️ С любовью, *Kaguya*\n` +
                   `╰━━━━━━━━━━━━━━━━━━━━╯`;

        case '/помощь':
        case '/help':
        case '/меню':
            return `🤖 *Kaguya 2.0 — бот 9-В класса*\n\n` +
                   `✨ *Gemini ИИ:*\n` +
                   `• \`/ai [вопрос]\` или \`кагуя [вопрос]\` — спросить ИИ\n` +
                   `• Ответь (reply) на моё сообщение — продолжить диалог\n` +
                   `• \`/сброс\` — очистить память ИИ\n\n` +
                   `📚 *Школа:*\n` +
                   `• \`/сегодня\`, \`/завтра\`, \`/урок\` — уроки и звонок\n` +
                   `• \`/расписание\`, \`/понедельник\`…\`/пятница\`\n` +
                   `• \`/люди\`, \`/dr\`, \`/скородр\`, \`/grr [имя]\`\n\n` +
                   `🏆 *Актив группы:*\n` +
                   `• \`/топ\` — топ активных в чате\n` +
                   `• \`/стата\` — твой ранг, уровень и XP\n` +
                   `• \`/дуэль\` (ответом) — битва 1 на 1\n` +
                   `• \`/все [текст]\` — позвать всю группу\n\n` +
                   `🎮 *Игры и фан:*\n` +
                   `• \`/кто [текст]\`, \`/инфа [текст]\`, \`/шар [вопрос]\`\n` +
                   `• \`/выбери [А] или [Б]\`, \`/шип [А + Б]\`, \`/цитата\`\n` +
                   `• \`/banana\`, \`/news\`, \`/palc\`, \`/baran\`\n\n` +
                   `💞 *Отношения и RP:*\n` +
                   `• \`/rp\` — список всех RP-действий\n` +
                   `• \`/пара\`, \`/пары\`, \`/пол м|ж\`, \`/расстаться\`\n` +
                   `• \`/создатель\` — автор бота`;

        case '/panel':
            return `🎛️ *Панель команд Kaguya 2.0:*\n\n` +
                   `/ai /сброс\n` +
                   `/сегодня /завтра /урок /расписание\n` +
                   `/понедельник /вторник /среда /четверг /пятница\n` +
                   `/люди /dr /скородр /grr\n` +
                   `/топ /стата /дуэль /все /rp\n` +
                   `/кто /инфа /шар /выбери /шип /цитата\n` +
                   `/пара /пары /пол /расстаться\n` +
                   `/banana /news /palc /baran /создатель /помощь`;

        default:
            return null;
    }
}

module.exports = { handleIncomingMessage, isCreatorQuestion };
