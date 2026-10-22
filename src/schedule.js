const config = require('./config');

// Расписание по дням недели с указанием времени уроков
const scheduleData = {
    monday: {
        name: 'Понедельник',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Алгебра' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Геометрия' },
            { timeStart: '09:15', timeEnd: '10:00', subject: 'Физика' },
            { timeStart: '10:10', timeEnd: '10:55', subject: 'История' }
        ]
    },
    tuesday: {
        name: 'Вторник',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Химия' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Биология' },
            { timeStart: '09:15', timeEnd: '10:00', subject: 'Английский язык' },
            { timeStart: '10:10', timeEnd: '10:55', subject: 'Литература' }
        ]
    },
    wednesday: {
        name: 'Среда',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Алгебра' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Информатика' },
            { timeStart: '09:15', timeEnd: '10:00', subject: 'География' },
            { timeStart: '10:10', timeEnd: '10:55', subject: 'Физика' }
        ]
    },
    thursday: {
        name: 'Четверг',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'История' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Алгебра' },
            { timeStart: '09:15', timeEnd: '10:00', subject: 'Английский язык' },
            { timeStart: '10:10', timeEnd: '10:55', subject: 'Физкультура' }
        ]
    },
    friday: {
        name: 'Пятница',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Биология' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Химия' },
            { timeStart: '09:15', timeEnd: '10:00', subject: 'Литература' },
            { timeStart: '10:10', timeEnd: '10:55', subject: 'Классный час' }
        ]
    }
};

function formatDaySchedule(dayKey) {
    const day = scheduleData[dayKey];
    if (!day) return 'Расписание не найдено.';

    let text = `📅 Расписание: ${day.name} (${config.schoolName}, ${config.className})\n\n`;
    day.lessons.forEach((l, index) => {
        text += `${index + 1}. ${l.timeStart} - ${l.timeEnd} | *${l.subject}*\n`;
    });
    return text.trim();
}

function getFullScheduleMenu() {
    return `📋 Меню расписания 9-В:\n\n` +
           `/понедельник\n/вторник\n/среда\n/четверг\n/пятница`;
}

// Получить текущий день недели (UTC+6 Кыргызстан)
function getCurrentDayKey() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kgDate = new Date(utc + (3600000 * 6));
    const dayIndex = kgDate.getDay();

    const daysMap = {
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday'
    };
    return daysMap[dayIndex] || null;
}

// Получить время HH:MM по Кыргызстану
function getCurrentTimeString() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kgDate = new Date(utc + (3600000 * 6));
    const hours = String(kgDate.getHours()).padStart(2, '0');
    const minutes = String(kgDate.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

module.exports = {
    scheduleData,
    formatDaySchedule,
    getFullScheduleMenu,
    getCurrentDayKey,
    getCurrentTimeString
};
