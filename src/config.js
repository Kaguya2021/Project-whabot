require('dotenv').config();

module.exports = {
    databaseUrl: process.env.DATABASE_URL,
    pairPhone: process.env.PAIR_PHONE,
    schoolName: '№104 ЖББ мектеби',
    className: '9-В класс',

    birthdayTime: '06:00',
    birthdayWindowEnd: '12:00',

    groupJids: (process.env.GROUP_JIDS || '').split(',').map(s => s.trim()).filter(Boolean),

    // Gemini AI (ключ из Google AI Studio: https://aistudio.google.com/apikey)
    aiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
    aiModel: (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim(),
    aiThinkingLevel: (process.env.GEMINI_THINKING || 'minimal').trim().toLowerCase(),
    aiCooldownMs: Number(process.env.AI_COOLDOWN_MS) || 4000,
    aiReplyTrigger: process.env.AI_REPLY_TRIGGER !== 'false',

    // Групповые фишки
    welcomeEnabled: process.env.WELCOME_ENABLED !== 'false',
    tagAllCooldownMs: Number(process.env.TAGALL_COOLDOWN_MS) || 60000
};
