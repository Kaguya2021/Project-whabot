const config = require('./config');

const SYSTEM_PROMPT =
    'Ты Kaguya — дружелюбный бот 9-В класса, отвечаешь в WhatsApp-чате школьников. ' +
    'Отвечай на языке вопроса, коротко и по делу (до 800 символов), без воды. ' +
    'Форматирование WhatsApp: жирный — *текст* (одна звёздочка), без markdown-заголовков и таблиц. ' +
    'Не помогай с вредными, опасными или взрослыми темами — вежливо откажись.';

const lastRequestAt = new Map(); // senderJid -> timestamp, защита от спама

const HINT = '🤖 Напиши после /ai свой вопрос, например: /ai Что такое фотосинтез?';

async function getAIResponse(sock, senderJid, queryText) {
    const query = (queryText || '').trim();
    if (!query) return HINT;

    if (!config.aiApiKey) {
        return '⚠️ ИИ пока не подключён: в настройках бота не задан ANTHROPIC_API_KEY.';
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
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'content-type': 'application/json',
                'x-api-key': config.aiApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: config.aiModel,
                max_tokens: 600,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: query.slice(0, 2000) }]
            })
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error('[ai] HTTP', res.status, body.slice(0, 300));
            return '😵 ИИ сейчас не отвечает, попробуй позже.';
        }

        const data = await res.json();
        const text = (data.content || [])
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n')
            .trim();

        if (!text) return '🤔 ИИ вернул пустой ответ, переформулируй вопрос.';
        return `✨ *Kaguya AI:*\n\n${text.slice(0, 3500)}`;
    } catch (err) {
        console.error('[ai] ошибка:', err.name === 'AbortError' ? 'таймаут 30с' : err.message);
        return '😵 ИИ сейчас не отвечает, попробуй позже.';
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { getAIResponse };
