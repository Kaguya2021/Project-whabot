// /ai без API-ключа: бесплатный сервис Pollinations.ai (text.pollinations.ai)

const SYSTEM_PROMPT =
    'Ты Kaguya — дружелюбный бот 9-В класса, отвечаешь в WhatsApp-чате школьников. ' +
    'Отвечай на языке вопроса, коротко и по делу (до 800 символов), без воды. ' +
    'Форматирование WhatsApp: жирный — *текст* (одна звёздочка), без markdown-заголовков и таблиц. ' +
    'Не помогай с вредными, опасными или взрослыми темами — вежливо откажись.';

const MODEL = process.env.AI_MODEL || 'openai';
const POST_URL = 'https://text.pollinations.ai/openai';
const GET_URL = 'https://text.pollinations.ai/';

const USER_COOLDOWN_MS = 20000;   // один человек — не чаще раза в 20 сек
const GLOBAL_GAP_MS = 15000;      // анонимный лимит сервиса ~1 запрос в 15 сек на всех
const TIMEOUT_MS = 60000;

const HINT = '🤖 Напиши после /ai свой вопрос, например: /ai Что такое фотосинтез?';
const FAIL = '😵 ИИ сейчас не отвечает, попробуй позже.';

const lastUserAt = new Map();
let lastGlobalAt = 0;

// Сервис иногда дописывает рекламный блок в конец ответа — убираем.
function cleanAnswer(text) {
    let t = String(text || '').trim();
    const adIdx = t.search(/\n+\s*(-{3,}|\*{3,})[\s\S]*pollinations/i);
    if (adIdx > 0) t = t.slice(0, adIdx);
    t = t.replace(/^.*powered by pollinations.*$/gim, '').trim();
    return t;
}

async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function askPost(query) {
    const res = await fetchWithTimeout(POST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: query }
            ]
        })
    });
    if (!res.ok) throw new Error(`POST HTTP ${res.status}`);

    const raw = await res.text();
    try {
        const data = JSON.parse(raw);
        return data.choices?.[0]?.message?.content || '';
    } catch (e) {
        return raw; // сервис мог вернуть просто текст
    }
}

async function askGet(query) {
    const url = `${GET_URL}${encodeURIComponent(query)}?model=${encodeURIComponent(MODEL)}&system=${encodeURIComponent(SYSTEM_PROMPT)}`;
    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) throw new Error(`GET HTTP ${res.status}`);
    return await res.text();
}

async function getAIResponse(sock, senderJid, queryText) {
    const query = (queryText || '').trim();
    if (!query) return HINT;

    const now = Date.now();

    const lastUser = lastUserAt.get(senderJid) || 0;
    if (now - lastUser < USER_COOLDOWN_MS) {
        const wait = Math.ceil((USER_COOLDOWN_MS - (now - lastUser)) / 1000);
        return `⏳ Подожди ${wait} сек. перед следующим вопросом.`;
    }
    if (now - lastGlobalAt < GLOBAL_GAP_MS) {
        const wait = Math.ceil((GLOBAL_GAP_MS - (now - lastGlobalAt)) / 1000);
        return `⏳ ИИ сейчас занят другим запросом, попробуй через ${wait} сек.`;
    }

    lastUserAt.set(senderJid, now);
    lastGlobalAt = now;
    if (lastUserAt.size > 500) lastUserAt.delete(lastUserAt.keys().next().value);

    const prompt = query.slice(0, 1500);

    let answer = '';
    try {
        answer = await askPost(prompt);
    } catch (err) {
        console.error('[ai] основной запрос не удался:', err.name === 'AbortError' ? 'таймаут' : err.message);
        try {
            answer = await askGet(prompt);
        } catch (err2) {
            console.error('[ai] запасной запрос не удался:', err2.name === 'AbortError' ? 'таймаут' : err2.message);
            return FAIL;
        }
    }

    answer = cleanAnswer(answer);
    if (!answer) return '🤔 ИИ вернул пустой ответ, переформулируй вопрос.';
    return `✨ *Kaguya AI:*\n\n${answer.slice(0, 3500)}`;
}

module.exports = { getAIResponse };
