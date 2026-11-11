const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');
const { studentsBirthdays } = require('./people');

const students = studentsBirthdays.map(s => s.fullName);
const HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');

let pool = null;
function db() {
    if (!pool) {
        pool = new Pool({
            connectionString: config.databaseUrl,
            ssl: { rejectUnauthorized: false },
            max: 3,
            idleTimeoutMillis: 30000
        });
        pool.on('error', (err) => console.error('[attendance pg]', err.message));
    }
    return pool;
}

let ready = null;
function init() {
    if (!ready) {
        ready = db().query(`
            CREATE TABLE IF NOT EXISTS attendance_reports (
                report_date DATE PRIMARY KEY,
                absent JSONB NOT NULL DEFAULT '[]',
                sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `).catch((e) => { ready = null; throw e; });
    }
    return ready;
}

// Кыргызстан UTC+6
function todayIso() {
    return new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
}

const fmtDate = (iso) => iso.split('-').reverse().join('.');

// Отчёты хранятся до ближайшего 25 мая после даты отчёта, потом удаляются.
async function cleanup() {
    await init();
    const res = await db().query(`
        DELETE FROM attendance_reports
        WHERE $1::date > CASE
            WHEN report_date <= make_date(EXTRACT(YEAR FROM report_date)::int, 5, 25)
                THEN make_date(EXTRACT(YEAR FROM report_date)::int, 5, 25)
            ELSE make_date(EXTRACT(YEAR FROM report_date)::int + 1, 5, 25)
        END
    `, [todayIso()]);
    if (res.rowCount) console.log(`[attendance] удалено старых отчётов: ${res.rowCount}`);
}

function buildMessage(iso, absent) {
    const absentSet = new Set(absent);
    const missing = students.filter(n => absentSet.has(n));
    const present = students.filter(n => !absentSet.has(n));

    let t = `📋 *Отчёт посещаемости*\n`;
    t += `${config.className} • ${fmtDate(iso)}\n\n`;
    t += `✅ Пришли: *${present.length}*\n`;
    t += `Н  Не пришли: *${missing.length}*\n`;
    if (missing.length) {
        t += `\n*Не пришли:*\n`;
        t += missing.map((n, i) => `${i + 1}. Н — ${n}`).join('\n') + '\n';
    }
    if (present.length) {
        t += `\n*Пришли:*\n`;
        t += present.map((n, i) => `${i + 1}. ✅ ${n}`).join('\n') + '\n';
    }
    return t.trim();
}

function json(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (c) => {
            raw += c;
            if (raw.length > 100000) { reject(new Error('Слишком большой запрос')); req.destroy(); }
        });
        req.on('end', () => {
            try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error('Неверный JSON')); }
        });
        req.on('error', reject);
    });
}

// send(text) — отправка в одну заданную группу (см. index.js)
function createHandler({ send }) {
    init().then(cleanup).catch((e) => console.error('[attendance] init:', e.message));
    setInterval(() => cleanup().catch(() => {}), 6 * 3600000);

    return async function handler(req, res) {
        try {
            const url = new URL(req.url, 'http://localhost');

            if (url.pathname === '/health') {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('OK');
            }

            if (url.pathname === '/' || url.pathname === '/index.html') {
                const html = fs.readFileSync(HTML_PATH);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                return res.end(html);
            }

            if (!url.pathname.startsWith('/api/')) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('Not found');
            }

            const password = process.env.REPORT_PASSWORD;
            if (password && req.headers['x-pass'] !== password) {
                return json(res, 401, { error: 'Нужен пароль' });
            }

            await init();

            if (req.method === 'GET' && url.pathname === '/api/init') {
                const today = todayIso();
                const r = await db().query(
                    `SELECT absent FROM attendance_reports WHERE report_date = $1`, [today]);
                return json(res, 200, {
                    students,
                    today,
                    absent: r.rows.length ? r.rows[0].absent : null
                });
            }

            if (req.method === 'GET' && url.pathname === '/api/reports') {
                const r = await db().query(
                    `SELECT to_char(report_date, 'YYYY-MM-DD') AS d FROM attendance_reports ORDER BY report_date DESC`);
                return json(res, 200, { dates: r.rows.map(x => x.d) });
            }

            if (req.method === 'GET' && url.pathname === '/api/report') {
                const d = url.searchParams.get('date') || '';
                if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json(res, 400, { error: 'Неверная дата' });
                const r = await db().query(
                    `SELECT absent FROM attendance_reports WHERE report_date = $1`, [d]);
                if (!r.rows.length) return json(res, 404, { error: 'Отчёт не найден' });
                return json(res, 200, { date: d, students, absent: r.rows[0].absent });
            }

            if (req.method === 'POST' && url.pathname === '/api/send') {
                const body = await readBody(req);
                const known = new Set(students);
                const absent = [...new Set(Array.isArray(body.absent) ? body.absent : [])]
                    .filter(n => known.has(n));
                const today = todayIso();

                // Сначала отправляем в группу — сохраняем только если отправка прошла
                await send(buildMessage(today, absent));

                await db().query(`
                    INSERT INTO attendance_reports (report_date, absent, sent_at)
                    VALUES ($1, $2::jsonb, now())
                    ON CONFLICT (report_date) DO UPDATE SET absent = EXCLUDED.absent, sent_at = now()
                `, [today, JSON.stringify(absent)]);

                return json(res, 200, { ok: true, date: today });
            }

            json(res, 404, { error: 'Не найдено' });
        } catch (err) {
            console.error('[attendance]', err.message);
            json(res, 500, { error: err.message || 'Ошибка сервера' });
        }
    };
}

module.exports = { createHandler };
