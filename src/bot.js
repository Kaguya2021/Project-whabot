const { formatDaySchedule, getFullScheduleMenu } = require('./schedule');
const { getPeopleList } = require('./people');
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
                   `/помощь — список команд`;

        case '/banana':
            return getBananaResponse(targetParam);

        case '/news':
            return getNewsResponse(targetParam);

        case '/palc':
            return getPalcResponse();

        case '/baran':
            return getRandomBaranFact();

        default:
            return `Неизвестная команда.\nИспользуйте /помощь, чтобы посмотреть доступные команды.`;
    }
}

module.exports = { handleIncomingMessage };
