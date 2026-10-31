const config = require('./config');

const SYSTEM_PROMPT =
    'Ты Kaguya — дружелюбный бот 9-В класса, отвечаешь в WhatsApp-чате школьников. ' +
    'Отвечай на языке вопроса, коротко и по делу (до 800 символов), без воды. ' +
    'Форматирование WhatsApp: жирный — *текст* (одна звёздочка), без markdown-заголовков и таблиц. ' +
    'Не помогай с вредными, опасными или взрослыми темами — вежливо откажись.';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const HINT = '🤖 Напиши после /ai свой вопрос, например: /ai Что такое фотосинтез?';
const FAIL = '😵 ИИ сейчас не отвечает, попробуй позже.';

const lastRequestAt = new Map(); // senderJid -> timestamp, защита от спама

async function getAIResponse(sock, senderJid, queryText) {
    const query = (queryText || '').trim();
    if (!query) return HINT;

    if (!config.aiApiKey) {
        return '⚠️ ИИ пока не подключён: в настройках бота не задан GEMINI_API_KEY.';
    }

    const now = Date.now();
    const last = lastRequestAt.get(senderJid) || 0;
    if (now - last < config.aiCooldownMs) {
        const wait = Math.ceil((config.aiCooldownMs - (now - last)) / 1000);
        return `⏳ Подожди ${wait} сек. перед следующим вопросом.`;
    }
    lastRequestAt.set(senderJid, now);
    if (lastRequestAt.size > 500) lastRequestAt.delete(lastRequestAt.keys().next().value);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(config.aiModel)}:generateContent`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'content-type': 'application/json',
                'x-goog-api-key': config.aiApiKey
            },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: query.slice(0, 2000) }] }],
                generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
            })
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error('[ai] HTTP', res.status, body.slice(0, 300));
            if (res.status === 429) return '⏳ На сегодня (или на эту минуту) лимит бесплатного ИИ исчерпан, попробуй позже.';
            if (res.status === 404) console.error('[ai] Модель не найдена. Проверь GEMINI_MODEL в .env');
            return FAIL;
        }

        const data = await res.json();

        if (data.promptFeedback?.blockReason) {
            return '🚫 На такой вопрос я отвечать не буду.';
        }

        const candidate = data.candidates?.[0];
        const text = (candidate?.content?.parts || [])
            .map(part => part.text || '')
            .join('')
            .trim();

        if (!text) {
            return candidate?.finishReason === 'SAFETY'
                ? '🚫 На такой вопрос я отвечать не буду.'
                : '🤔 ИИ вернул пустой ответ, переформулируй вопрос.';
        }
        return `✨ *Kaguya AI:*\n\n${text.slice(0, 3500)}`;
    } catch (err) {
        console.error('[ai] ошибка:', err.name === 'AbortError' ? 'таймаут 30с' : err.message);
        return FAIL;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { getAIResponse };
