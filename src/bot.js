const { formatDaySchedule, getFullScheduleMenu } = require('./schedule');
const { getPeopleList, getBirthdayGreeting } = require('./people');
const { getBananaResponse, getNewsResponse, getPalcResponse, getRandomBaranFact } = require('./fun');

function handleIncomingMessage(text) {
    const cleanText = text.trim();

    if (!cleanText.startsWith('/')) {
        return null;
    }

    const parts = cleanText.split(' ');
    const command = parts[0].toLowerCase();
    const targetParam = parts.slice(1).join(' ');

    switch (command) {
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

        case '/создатель':
            return `╭━━━━━━━━━━━━━━━━━━━━╮\n` +
                   `✦ 𝐂𝐑𝐄𝐀𝐓𝐎𝐑 𝐈𝐍𝐅𝐎 ✦\n` +
                   `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
                   `👑 **Создатель:** Kaguya 2.0\n` +
                   `💻 **Разработчик:** Kaguya 2.0\n` +
                   `⚡ **Автор проекта:** Kaguya 2.0\n\n` +
                   `╭─────── SOCIAL MEDIA ───────╮\n\n` +
                   `✈️ **Telegram:** @kaguya2_0\n` +
                   `🔗 https://t.me/kaguya2_0\n\n` +
                   `💬 **WhatsApp:** Связаться со мной\n` +
                   `🔗 https://wa.me/996700214091\n\n` +
                   `╰──────────────────────────╯\n\n` +
                   `🛠️ Разработка • Обновления • Новые проекты\n\n` +
                   `♥️ С любовью, **Kaguya 2.0**\n` +
                   `╰━━━━━━━━━━━━━━━━━━━━╯`;

        case '/помощь':
            return `Бот расписания 9-В\n\n` +
                   `Доступные команды:\n` +
                   `/понедельник — расписание понедельника\n` +
                   `/вторник — расписание вторника\n` +
                   `/среда — расписание среды\n` +
                   `/четверг — расписание четверга\n` +
                   `/пятница — расписание пятницы\n` +
                   `/расписание — меню расписания\n` +
                   `/люди — список учеников\n` +
                   `/создатель — информация об авторе\n` +
                   `/помощь — список команд`;

        // Секретные команды (нет в /помощь)
        case '/panel':
            return `🎛️ Секретная панель управления:\n\n` +
                   `/понедельник\n/вторник\n/среда\n/четверг\n/пятница\n` +
                   `/расписание\n/люди\n/создатель\n/grr [Имя]\n` +
                   `/banana\n/news\n/palc\n/baran`;

        case '/grr':
            return getBirthdayGreeting(targetParam) || 'Укажите имя ученика, например: /grr Эмир';

        case '/banana':
            return getBananaResponse(targetParam);

        case '/news':
            return getNewsResponse(targetParam);

        case '/palc':
            return getPalcResponse();

        case '/baran':
            return getRandomBaranFact();

        default:
            return null; // Неизвестные команды игнорируются в группах
    }
}

module.exports = { handleIncomingMessage };
