require('dotenv').config();

module.exports = {
    databaseUrl: process.env.DATABASE_URL,
    pairPhone: process.env.PAIR_PHONE,
    schoolName: '№104 ЖББ мектеби',
    className: '9-В класс',

    // Поздравления с ДР: время по Кыргызстану (UTC+6).
    // Если бот был выключен в 06:00, он поздравит позже — но не позже birthdayWindowEnd.
    birthdayTime: '06:00',
    birthdayWindowEnd: '12:00',

    // Необязательно: JID групп через запятую (120363...@g.us), если нужно слать только в них.
    groupJids: (process.env.GROUP_JIDS || '').split(',').map(s => s.trim()).filter(Boolean),

    // ИИ для /ai (Anthropic API)
    aiApiKey: process.env.ANTHROPIC_API_KEY,
    aiModel: process.env.AI_MODEL || 'claude-haiku-5-5',
    aiCooldownMs: 10000
};
