const scheduleData = {
    monday: {
        name: 'Понедельник',
        lessons: [
            { timeStart: '07:30', timeEnd: '08:15', subject: 'К-тил' },
            { timeStart: '08:20', timeEnd: '09:05', subject: 'Технол' },
            { timeStart: '09:10', timeEnd: '09:55', subject: 'Хим' },
            { timeStart: '10:05', timeEnd: '10:50', subject: 'Дин тарых' },
            { timeStart: '10:55', timeEnd: '11:40', subject: 'Алгебра' },
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

const DAYS_MAP = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };

function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

// Кыргызстан: UTC+6 без перехода на летнее время
function getKgDate() {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 6 * 3600000);
}

function getCurrentDayKey() {
    return DAYS_MAP[getKgDate().getDay()] || null;
}

function getCurrentTimeString() {
    const d = getKgDate();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getCurrentDateString() {
    const d = getKgDate();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentYearString() {
    return String(getKgDate().getFullYear());
}

function formatDaySchedule(dayKey, highlightNow = false) {
    const day = scheduleData[dayKey];
    if (!day) return 'Расписание не найдено.';

    const nowMin = highlightNow ? toMinutes(getCurrentTimeString()) : -1;
    let text = `📅 *Расписание: ${day.name}*\n\n`;
    day.lessons.forEach((l, index) => {
        const start = toMinutes(l.timeStart);
        const end = toMinutes(l.timeEnd);
        const mark = highlightNow && nowMin >= start && nowMin < end ? ' ◀️ _сейчас_' : '';
        text += `${index + 1}. ${l.timeStart}–${l.timeEnd} | *${l.subject}*${mark}\n`;
    });
    return text.trim();
}

function formatTodaySchedule() {
    const key = getCurrentDayKey();
    if (!key) return '😎 Сегодня выходной — уроков нет! Отдыхаем.';
    return formatDaySchedule(key, true);
}

function formatTomorrowSchedule() {
    const tomorrowDay = (getKgDate().getDay() + 1) % 7;
    const key = DAYS_MAP[tomorrowDay];
    if (!key) return '🎉 Завтра выходной — уроков нет!';
    return `⏭️ *На завтра:*\n\n${formatDaySchedule(key, false)}`;
}

function getCurrentLessonStatus() {
    const key = getCurrentDayKey();
    const nowStr = getCurrentTimeString();
    if (!key) return `😎 Сейчас выходной (${nowStr}), уроков нет!`;

    const lessons = scheduleData[key].lessons;
    const nowMin = toMinutes(nowStr);
    const firstStart = toMinutes(lessons[0].timeStart);
    const lastEnd = toMinutes(lessons[lessons.length - 1].timeEnd);

    if (nowMin < firstStart) {
        const left = firstStart - nowMin;
        return `⏰ Сейчас *${nowStr}*.\nДо 1-го урока (*${lessons[0].subject}*) осталось *${left} мин.*`;
    }

    if (nowMin >= lastEnd) {
        return `🎉 Уроки на сегодня закончились! (сейчас *${nowStr}*)`;
    }

    for (let i = 0; i < lessons.length; i++) {
        const l = lessons[i];
        const start = toMinutes(l.timeStart);
        const end = toMinutes(l.timeEnd);

        if (nowMin >= start && nowMin < end) {
            const left = end - nowMin;
            const next = lessons[i + 1];
            const nextLine = next ? `\nСледующий: *${next.subject}* (${next.timeStart})` : '\nЭто последний урок! 🔥';
            return `📚 Сейчас *${i + 1}-й урок*: *${l.subject}*\n⏳ До звонка: *${left} мин.* (${l.timeEnd})${nextLine}`;
        }

        const next = lessons[i + 1];
        if (next && nowMin >= end && nowMin < toMinutes(next.timeStart)) {
            const left = toMinutes(next.timeStart) - nowMin;
            return `🔔 *Перемена!* (сейчас ${nowStr})\nЧерез *${left} мин.* начнётся *${i + 2}-й урок*: *${next.subject}*`;
        }
    }

    return `⏰ Сейчас *${nowStr}*.`;
}

function getFullScheduleMenu() {
    return `📋 *Меню расписания 9-В:*\n\n` +
           `/сегодня — уроки сегодня\n` +
           `/завтра — уроки завтра\n` +
           `/урок — какой сейчас урок и сколько до звонка\n\n` +
           `/понедельник\n/вторник\n/среда\n/четверг\n/пятница`;
}

module.exports = {
    scheduleData,
    formatDaySchedule,
    formatTodaySchedule,
    formatTomorrowSchedule,
    getCurrentLessonStatus,
    getFullScheduleMenu,
    getKgDate,
    getCurrentDayKey,
    getCurrentTimeString,
    getCurrentDateString,
    getCurrentYearString
};
