// Быстрый и умный ИИ на базе Google Gemini API (нативный fetch, без лишних пакетов)
const config = require('./config');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 25000;
const HISTORY_LIMIT = 10;          // 5 пар «вопрос-ответ» на чат
const HISTORY_TTL_MS = 15 * 60 * 1000;
const MAX_STORED_CHATS = 200;

const SYSTEM_PROMPT =
    'Ты Kaguya — умный, живой и быстрый ИИ-бот 9-В класса (школа №104, Бишкек) в WhatsApp-группе. ' +
    'Тебя создал Шайлообеков Умар, ученик 9-В класса. Если спросят, кто тебя создал — отвечай прямо. ' +
    'Отвечай на языке вопроса (русский, кыргызский, английский и т.д.), чётко, по делу, без воды и канцелярита. ' +
    'Держись дружелюбного, уверенного стиля общения, подходящего для молодёжной группы. ' +
    'Помогай с учёбой (алгебра, физика, химия, языки, история, код) — объясняй понятно и по шагам, но компактно. ' +
    'Форматирование строго под WhatsApp: жирный — *текст* (одна звёздочка), курсив — _текст_, зачёркнутый — ~текст~. ' +
    'Никаких markdown-заголовков (#), двойных звёздочек (**) и сложных таблиц. ' +
    'Обычно укладывайся в 2–8 строк (до 900 символов), длиннее — только если просят подробный разбор. ' +
    'Не помогай с опасными, вредными или 18+ темами — коротко и вежливо откажись.';

const INTRO =
    `🤖 *Kaguya AI • Gemini Edition*\n\n` +
    `Умный и быстрый ИИ-помощник 9-В класса на базе *Google Gemini*.\n\n` +
    `*Как обращаться:*\n` +
    `• \`/ai вопрос\` — задать любой вопрос\n` +
    `• \`кагуя вопрос\` — спросить без слеша\n` +
    `• Ответить (reply) на моё сообщение — продолжить диалог\n` +
    `• Ответить на чужое сообщение с \`/ai объясни\` — разберу контекст\n` +
    `• \`/ai сброс\` — очистить память диалога\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `👑 *Создатель:* Шайлообеков Умар (9-В)`;

const NO_KEY_MSG =
    `🔑 Не задан *GEMINI_API_KEY* в переменных окружения (.env).\n` +
    `Получи ключ в Google AI Studio: https://aistudio.google.com/apikey`;

const lastUserAt = new Map();
const chatHistories = new Map(); // chatJid -> { updatedAt, turns: [{ role, parts }] }

function getFallbackModels() {
    const list = [
        config.aiModel,
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-flash-latest'
    ].filter(Boolean);
    return [...new Set(list)];
}

function formatForWhatsApp(text) {
    let t = String(text || '').trim();
    if (!t) return '';
    // Markdown **bold** -> WhatsApp *bold*
    t = t.replace(/\*\*([^*\n]+?)\*\*/g, '*$1*');
    // Markdown headings (### Title) -> *Title*
    t = t.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
    // Markdown bullet "* item" -> "• item" (чтобы не путать с курсивом/жирным)
    t = t.replace(/^\s*[-*]\s+/gm, '• ');
    // Убираем лишние пустые строки (больше двух подряд)
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
}

function getHistory(chatJid) {
    const entry = chatHistories.get(chatJid);
    if (!entry) return [];
    if (Date.now() - entry.updatedAt > HISTORY_TTL_MS) {
        chatHistories.delete(chatJid);
        return [];
    }
    return entry.turns;
}

function pushHistory(chatJid, userText, modelText) {
    const turns = getHistory(chatJid).slice();
    turns.push({ role: 'user', parts: [{ text: userText }] });
    turns.push({ role: 'model', parts: [{ text: modelText }] });
    while (turns.length > HISTORY_LIMIT) turns.shift();

    chatHistories.set(chatJid, { updatedAt: Date.now(), turns });
    if (chatHistories.size > MAX_STORED_CHATS) {
        chatHistories.delete(chatHistories.keys().next().value);
    }
}

function clearHistory(chatJid) {
    chatHistories.delete(chatJid);
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

function buildPayload(contents, includeThinking = true) {
    const generationConfig = { maxOutputTokens: 1024 };
    if (includeThinking && config.aiThinkingLevel && config.aiThinkingLevel !== 'off') {
        generationConfig.thinkingConfig = {
            thinkingLevel: config.aiThinkingLevel
        };
    }

    return {
        systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
        contents,
        generationConfig
    };
}

function extractText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .filter((p) => typeof p?.text === 'string' && !p.thought)
        .map((p) => p.text)
        .join('')
        .trim();
}

async function callGeminiModel(model, contents, includeThinking = true) {
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': config.aiApiKey
        },
        body: JSON.stringify(buildPayload(contents, includeThinking))
    });

    const raw = await res.text();
    let data = null;
    try {
        data = JSON.parse(raw);
    } catch {
        data = null;
    }

    if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
    }

    const answer = extractText(data);
    if (!answer) {
        const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
        if (reason === 'SAFETY') {
            return '⚠️ На этот запрос не могу ответить из-за ограничений безопасности.';
        }
        throw new Error('Пустой ответ от модели');
    }
    return answer;
}

async function askGemini(contents) {
    const models = getFallbackModels();
    let lastError = null;

    for (const model of models) {
        try {
            return await callGeminiModel(model, contents, true);
        } catch (err) {
            // Если модель не поддерживает thinkingConfig — пробуем ту же модель без него
            if (err.status === 400 && /thinking/i.test(err.message)) {
                try {
                    return await callGeminiModel(model, contents, false);
                } catch (err2) {
                    lastError = err2;
                    continue;
                }
            }

            // Невалидный ключ или нет прав — дальше по моделям идти бессмысленно
            if (err.status === 401 || err.status === 403) {
                throw err;
            }

            console.error(`[ai] модель ${model} не ответила:`, err.name === 'AbortError' ? 'таймаут' : err.message);
            lastError = err;
        }
    }

    throw lastError || new Error('Все модели Gemini недоступны');
}

/**
 * Получить ответ от Gemini AI.
 * @param {string} chatJid — JID чата/группы (для контекста диалога)
 * @param {string} senderJid — JID отправителя (для кулдауна)
 * @param {string} queryText — текст вопроса
 * @param {object} [opts] — { senderName?: string, quotedText?: string }
 */
async function getAIResponse(chatJid, senderJid, queryText, opts = {}) {
    const query = String(queryText || '').trim();
    if (!query) return INTRO;

    if (/^(сброс|очистить|clear|reset)$/i.test(query)) {
        clearHistory(chatJid);
        return '🧹 Память диалога очищена. Начинаем с чистого листа!';
    }

    if (!config.aiApiKey) {
        return NO_KEY_MSG;
    }

    const now = Date.now();
    const cooldown = config.aiCooldownMs;
    const lastAt = lastUserAt.get(senderJid) || 0;
    if (now - lastAt < cooldown) {
        const wait = Math.ceil((cooldown - (now - lastAt)) / 1000);
        return `⏳ Подожди ${wait} сек.`;
    }
    lastUserAt.set(senderJid, now);
    if (lastUserAt.size > 500) lastUserAt.delete(lastUserAt.keys().next().value);

    const userParts = [];
    if (opts.quotedText) {
        userParts.push(`[Контекст сообщения, на которое ответили]: ${String(opts.quotedText).slice(0, 600)}`);
    }
    const prefix = opts.senderName ? `${opts.senderName}: ` : '';
    userParts.push(`${prefix}${query.slice(0, 2000)}`);
    const finalUserText = userParts.join('\n\n');

    const history = getHistory(chatJid);
    const contents = [
        ...history,
        { role: 'user', parts: [{ text: finalUserText }] }
    ];

    try {
        const rawAnswer = await askGemini(contents);
        const answer = formatForWhatsApp(rawAnswer);
        if (!answer) return '🤔 Не удалось сформировать ответ, переформулируй вопрос.';
        pushHistory(chatJid, finalUserText, answer);
        return answer.slice(0, 3500);
    } catch (err) {
        console.error('[ai] ошибка Gemini:', err.name === 'AbortError' ? 'таймаут' : err.message);
        if (err.status === 401 || err.status === 403) {
            return '🔑 Ошибка ключа Gemini API. Проверь GEMINI_API_KEY в настройках.';
        }
        if (err.status === 429) {
            return '⏳ Слишком много запросов к Gemini, попробуй через пару секунд.';
        }
        return '😵 Gemini сейчас не отвечает, попробуй ещё раз через пару секунд.';
    }
}

module.exports = { getAIResponse, clearHistory, INTRO };
