// Здесь меняется расписание. Больше нигде искать не нужно.
const schedule = {
  monday: ['К-тил', 'Технол', 'Хим', 'Дин тарых', 'Алгебр', 'К-адаб'],
  tuesday: ['Ч-тил', 'Д-тарбия', 'Биолог', 'Тарых', 'Геомет', 'Алгебра'],
  wednesday: ['Геогр', 'Физика', 'К-адаб', 'Инф-ка', 'А.ж.к', 'О-адаб'],
  thursday: ['Физика', 'Биолог', 'К-адаб', 'О-адаб', 'Геогр', 'Тарых'],
  friday: ['Алгебра', 'Д-тарбия', 'К-тил', 'Ч-тил', 'О-тил', 'Хим'],
};

const dayNames = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
};

const LINE = '────────────────';

function formatDay(key) {
  const lessons = schedule[key];
  if (!lessons) return null;
  const rows = lessons.map((l, i) => `${i + 1}. ${l}`).join('\n');
  return `📚 РАСПИСАНИЕ\n${dayNames[key]}\n\n${rows}\n\n${LINE}`;
}

module.exports = { schedule, dayNames, formatDay };
