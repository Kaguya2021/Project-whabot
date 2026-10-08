const config = require('./config');

const timeSlots = [
    '07:30 - 08:15',
    '08:20 - 09:05',
    '09:10 - 09:55',
    '10:05 - 10:50',
    '10:55 - 11:40',
    '11:45 - 12:30'
];

const scheduleData = {
    monday: ['К-тил', 'Технол', 'Хим', 'Дин тарых', 'Алгебр', 'К-адаб'],
    tuesday: ['Ч-тил', 'Д-тарбия', 'Биолог', 'Тарых', 'Геомет', 'Алгебра'],
    wednesday: ['Геогр', 'Физика', 'К-адаб', 'Инф-ка', 'А.ж.к', 'О-адаб'],
    thursday: ['Физика', 'Биолог', 'К-адаб', 'О-адаб', 'Геогр', 'Тарых'],
    friday: ['Алгебра', 'Д-тарбия', 'К-тил', 'Ч-тил', 'О-тил', 'Хим']
};

const dayNames = {
    monday: 'Понедельник',
    tuesday: 'Вторник',
    wednesday: 'Среда',
    thursday: 'Четверг',
    friday: 'Пятница'
};

function formatDaySchedule(dayKey) {
    const dayTitle = dayNames[dayKey];
    const lessons = scheduleData[dayKey];

    if (!lessons) return null;

    let response = `📚 РАСПИСАНИЕ\n${dayTitle}\n\n`;

    lessons.forEach((lesson, index) => {
        const time = timeSlots[index] || '';
        response += `${index + 1}. ${lesson} (${time})\n`;
    });

    response += `\n────────────────`;

    return response;
}

function getFullScheduleMenu() {
    return `📚 Расписание 9-В класса\n\n` +
           `Понедельник\n` +
           `Вторник\n` +
           `Среда\n` +
           `Четверг\n` +
           `Пятница\n\n` +
           `Для просмотра отправьте команду: /понедельник, /вторник и т.д.`;
}

module.exports = {
    formatDaySchedule,
    getFullScheduleMenu
};
