const config = require('./config');

// Актуальное расписание 9-В класса (6 уроков)
const scheduleData = {
    monday: {
        name: 'Понедельник',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'К-тил' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Технол' },
            { timeStart: '09:10', timeEnd: '09:55', subject: 'Хим' },
            { timeStart: '10:05', timeEnd: '10:50', subject: 'Дин тарых' },
            { timeStart: '10:55', timeEnd: '11:40', subject: 'Алгебр' },
            { timeStart: '11:45', timeEnd: '12:30', subject: 'К-адаб' }
        ]
    },
    tuesday: {
        name: 'Вторник',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Ч-тил' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Д-тарбия' },
            { timeStart: '09:10', timeEnd: '09:55', subject: 'Биолог' },
            { timeStart: '10:05', timeEnd: '10:50', subject: 'Тарых' },
            { timeStart: '10:55', timeEnd: '11:40', subject: 'Геомет' },
            { timeStart: '11:45', timeEnd: '12:30', subject: 'Алгебра' }
        ]
    },
    wednesday: {
        name: 'Среда',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Геогр' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Физика' },
            { timeStart: '09:10', timeEnd: '09:55', subject: 'К-адаб' },
            { timeStart: '10:05', timeEnd: '10:50', subject: 'Инф-ка' },
            { timeStart: '10:55', timeEnd: '11:40', subject: 'А.ж.к' },
            { timeStart: '11:45', timeEnd: '12:30', subject: 'О-адаб' }
        ]
    },
    thursday: {
        name: 'Четверг',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Физика' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Биолог' },
            { timeStart: '09:10', timeEnd: '09:55', subject: 'К-адаб' },
            { timeStart: '10:05', timeEnd: '10:50', subject: 'О-адаб' },
            { timeStart: '10:55', timeEnd: '11:40', subject: 'Геогр' },
            { timeStart: '11:45', timeEnd: '12:30', subject: 'Тарых' }
        ]
    },
    friday: {
        name: 'Пятница',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'Алгебра' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Д-тарбия' },
            { timeStart: '09:10', timeEnd: '09:55', subject: 'К-тил' },
            { timeStart: '10:05', timeEnd: '10:50', subject: 'Ч-тил' },
            { timeStart: '10:55', timeEnd: '11:40', subject: 'О-тил' },
            { timeStart: '11:45', timeEnd: '12:30', subject: 'Хим' }
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

// Получить текущее время HH:MM по Кыргызстану
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
