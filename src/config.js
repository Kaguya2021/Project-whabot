require('dotenv').config();

module.exports = {
    databaseUrl: process.env.DATABASE_URL,
    pairPhone: process.env.PAIR_PHONE,
    schoolName: '№104 ЖББ мектеби',
    className: '9-В класс',

    birthdayTime: '06:00',
    birthdayWindowEnd: '12:00',

    groupJids: (process.env.GROUP_JIDS || '').split(',').map(s => s.trim()).filter(Boolean),

    aiApiKey: process.env.GEMINI_API_KEY,
    aiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    aiCooldownMs: 10000
};
