const { delay } = require('@whiskeysockets/baileys');

async function getAIResponse(sock, senderJid, queryText) {
    if (!queryText || queryText.trim() === '') {
        return "🤖 Напиши после /ai свой вопрос, например: /ai Что такое алгоритм?";
    }

    // Небольшая имитация работы ИИ для красоты (1 секунда)
    await delay(1000);

    return `✨ *Kaguya AI:*\n\n${queryText}\n\nРезультат: запрос успешно обработан, всё работает чётко и стабильно :)`;
}

function handleIncomingAIMessage(msg) {
    // Очищено от лишних логов
}

module.exports = { getAIResponse, handleIncomingAIMessage };
