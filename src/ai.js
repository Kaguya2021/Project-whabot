const { delay } = require('@whiskeysockets/baileys');

// Официальный JID Бизнес-ассистента Meta AI в WhatsApp
const META_AI_JID = '718584497008505@s.whatsapp.net';

// Временное хранилище для перехвата ответа от ассистента
let pendingAIResolve = null;

async function getAIResponse(sock, senderJid, queryText) {
    try {
        if (!queryText || queryText.trim() === '') {
            return "🤖 Напиши после /ai свой вопрос, например: /ai Что такое база данных?";
        }

        // 1. Отправляем вопрос в чат Бизнес-ассистента Meta AI
        await sock.sendMessage(META_AI_JID, { text: queryText });

        // 2. Ждем ответ от ассистента через промис с таймаутом (до 10 секунд)
        const answerPromise = new Promise((resolve) => {
            pendingAIResolve = resolve;
            setTimeout(() => {
                if (pendingAIResolve) {
                    pendingAIResolve = null;
                    resolve(null);
                }
            }, 10000);
        });

        let aiReplyText = await answerPromise;

        // Если ответ не пришел вовремя, делаем запасной вариант
        if (!aiReplyText) {
            aiReplyText = `Извини, ассистент не успел ответить вовремя, но твой запрос "${queryText}" был передан! :)`;
        }

        // Заменяем любые упоминания Meta AI на Kaguya AI
        let finalAnswer = aiReplyText
            .replace(/Meta AI/gi, 'Kaguya AI')
            .replace(/Мета АИ/gi, 'Kaguya AI')
            .replace(/бизнес-ассистентом Meta AI/gi, 'Kaguya AI');

        return finalAnswer;
    } catch (err) {
        console.error('[ERROR] Ошибка запроса к Meta AI:', err);
        return `⚠️ Ошибка связи с Kaguya AI. Попробуй еще раз!`;
    }
}

// Функция для перехвата сообщений от ассистента (вызывается из index.js)
function handleIncomingAIMessage(msg) {
    try {
        const remoteJid = msg.key.remoteJid;
        if (remoteJid === META_AI_JID && !msg.key.fromMe) {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            if (text && pendingAIResolve) {
                const resolve = pendingAIResolve;
                pendingAIResolve = null;
                resolve(text);
            }
        }
    } catch (err) {
        console.error('[ERROR] AI message intercept error:', err);
    }
}

module.exports = { getAIResponse, handleIncomingAIMessage };
