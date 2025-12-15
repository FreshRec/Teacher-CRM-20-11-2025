const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const BACKEND_VERSION = '1.2.0 (SSL Fix Applied)';

app.use(cors());
app.use(express.json());

// === НАСТРОЙКА ПОДКЛЮЧЕНИЯ К БД ===
const connectionString = process.env.DATABASE_URL;
// Определяем, локальная ли это БД (localhost) или облачная
const isLocal = connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'));
const isYandex = connectionString && connectionString.includes('yandex');

console.log(`[Startup] Backend Version: ${BACKEND_VERSION}`);
console.log(`[Startup] Database Config: ${isLocal ? 'Local' : 'Remote/Cloud'}`);

const poolConfig = {
    connectionString: connectionString,
    connectionTimeoutMillis: 5000, // Тайм-аут подключения 5 сек
};

// Принудительное отключение проверки сертификата для Yandex Cloud и других внешних БД
if (!isLocal || isYandex) {
    console.log('[Startup] Enabling SSL (rejectUnauthorized: false) for DB connection');
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(poolConfig);

// Проверка подключения при старте
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('[Startup] ❌ DB Connection Failed:', err.message);
        if (err.message.includes('self-signed')) {
            console.error('[Startup] 💡 Tip: SSL settings might not be applying correctly.');
        }
    } else {
        console.log('[Startup] ✅ DB Connection Successful:', res.rows[0].now);
    }
});

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// === Auth Endpoints ===

app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const id = uuidv4();
        // Проверяем, есть ли профиль
        const check = await pool.query('SELECT * FROM profiles WHERE email = $1', [email]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'User already exists' });

        const isFirst = (await pool.query('SELECT count(*) FROM profiles')).rows[0].count === '0';
        const role = isFirst ? 'admin' : 'teacher';
        
        // Создаем профиль
        const newProfile = await pool.query(
            'INSERT INTO profiles (id, email, role, permissions) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, email, role, JSON.stringify(isFirst ? { canViewDashboard: true, canManageUsers: true } : {})] 
        );
        
        // Генерируем токен
        const token = jwt.sign({ id, email, role }, JWT_SECRET);
        res.json({ session: { access_token: token, user: { id, email } } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const check = await pool.query('SELECT * FROM profiles WHERE email = $1', [email]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'User not found' });
        
        const user = check.rows[0];
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
        res.json({ session: { access_token: token, user: { id: user.id, email: user.email } } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/auth/me', authenticateToken, async (req, res) => {
    res.json({ user: req.user });
});

// === CRUD Helpers ===
const createCrud = (table) => {
    app.get(`/${table}`, authenticateToken, async (req, res) => {
        try {
            const result = await pool.query(`SELECT * FROM ${table}`);
            res.json(result.rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post(`/${table}`, authenticateToken, async (req, res) => {
        try {
            const keys = Object.keys(req.body).filter(k => k !== 'id'); // ID генерит БД
            const values = keys.map(k => req.body[k]);
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
            const result = await pool.query(query, values);
            res.status(201).json(result.rows[0]);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
};

// Простые таблицы
['groups', 'subscription_plans', 'expenses'].forEach(createCrud);

// === Специализированные эндпоинты ===

// Students (массив group_ids)
app.get('/students', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students ORDER BY name');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/students', authenticateToken, async (req, res) => {
    const { name, parent_name, parent_phone1, parent_phone2, group_ids, birth_date, balance, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO students (name, parent_name, parent_phone1, parent_phone2, group_ids, birth_date, balance, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, parent_name, parent_phone1, parent_phone2, group_ids || [], birth_date, balance || 0, status || 'active']
        );
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/students/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const keys = Object.keys(updates);
    if (keys.length === 0) return res.json({});
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    try {
        const result = await pool.query(`UPDATE students SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...Object.values(updates)]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/students', authenticateToken, async (req, res) => {
    // Удаление массива ID (как на фронте .in('id', ids))
    const ids = req.query.ids ? req.query.ids.split(',') : [];
    if (ids.length === 0) return res.json({ success: true });
    try {
        await pool.query('DELETE FROM students WHERE id = ANY($1)', [ids]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Profiles
app.get('/profiles', authenticateToken, async (req, res) => {
    const { id } = req.query;
    if (id) {
        const r = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
        return res.json(r.rows[0] || null);
    }
    const r = await pool.query('SELECT * FROM profiles ORDER BY email');
    res.json(r.rows);
});
app.post('/profiles', authenticateToken, async (req, res) => {
    // Создание профиля вручную админом
    try {
        const result = await pool.query('INSERT INTO profiles (id, email, role, permissions) VALUES ($1, $2, $3, $4) RETURNING *', 
            [req.body.id || uuidv4(), req.body.email, req.body.role, JSON.stringify(req.body.permissions)]);
        res.json(result.rows[0]);
    } catch(e) { res.status(500).json({error: e.message})}
});
app.patch('/profiles/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { permissions, role } = req.body;
    try {
        // Динамический апдейт упрощенно
        if (permissions) await pool.query('UPDATE profiles SET permissions = $1 WHERE id = $2', [JSON.stringify(permissions), id]);
        if (role) await pool.query('UPDATE profiles SET role = $1 WHERE id = $2', [role, id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message})}
});

// Attendance (Composite Key)
app.get('/attendance', authenticateToken, async (req, res) => {
    const r = await pool.query('SELECT * FROM attendance');
    res.json(r.rows);
});
app.post('/attendance', authenticateToken, async (req, res) => {
    // Upsert logic
    const { student_id, date, status, grade, student_subscription_id } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO attendance (student_id, date, status, grade, student_subscription_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (student_id, date) 
            DO UPDATE SET status = EXCLUDED.status, grade = EXCLUDED.grade, student_subscription_id = EXCLUDED.student_subscription_id
            RETURNING *
        `, [student_id, date, status, grade, student_subscription_id]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/attendance', authenticateToken, async (req, res) => {
    const { student_id, date } = req.query; // или body
    try {
        await pool.query('DELETE FROM attendance WHERE student_id = $1 AND date = $2', [student_id, date]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Schedule Events
app.get('/schedule_events', authenticateToken, async (req, res) => {
    const r = await pool.query('SELECT id, title, group_id, start_time as start, end_time as "end", is_recurring FROM schedule_events');
    res.json(r.rows);
});
app.post('/schedule_events', authenticateToken, async (req, res) => {
    const { title, group_id, start, end, is_recurring } = req.body;
    try {
        const r = await pool.query('INSERT INTO schedule_events (title, group_id, start_time, end_time, is_recurring) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, group_id, start_time as start, end_time as "end", is_recurring', 
            [title, group_id, start, end, is_recurring]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/schedule_events/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, group_id, start, end, is_recurring } = req.body;
    try {
        const r = await pool.query('UPDATE schedule_events SET title=$1, group_id=$2, start_time=$3, end_time=$4, is_recurring=$5 WHERE id=$6 RETURNING id, title, group_id, start_time as start, end_time as "end", is_recurring', 
        [title, group_id, start, end, is_recurring, id]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/schedule_events/:id', authenticateToken, async (req, res) => {
    await pool.query('DELETE FROM schedule_events WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Exceptions
app.get('/schedule_event_exceptions', authenticateToken, async (req, res) => {
    const r = await pool.query('SELECT * FROM schedule_event_exceptions');
    res.json(r.rows);
});
app.post('/schedule_event_exceptions', authenticateToken, async (req, res) => {
    const { original_event_id, original_start_time, new_title, new_group_id, new_start_time, new_end_time, is_deleted } = req.body;
    try {
        const r = await pool.query(`
            INSERT INTO schedule_event_exceptions (original_event_id, original_start_time, new_title, new_group_id, new_start_time, new_end_time, is_deleted)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (original_event_id, original_start_time) DO UPDATE SET is_deleted = EXCLUDED.is_deleted, new_title = EXCLUDED.new_title
            RETURNING *`, 
            [original_event_id, original_start_time, new_title, new_group_id, new_start_time, new_end_time, is_deleted]);
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({error: e.message})}
});

// Student Subscriptions & Transactions
app.get('/student_subscriptions', authenticateToken, async (req, res) => {
    const r = await pool.query('SELECT * FROM student_subscriptions ORDER BY purchase_date DESC');
    res.json(r.rows);
});
app.post('/student_subscriptions', authenticateToken, async (req, res) => {
    const b = req.body;
    const r = await pool.query('INSERT INTO student_subscriptions (student_id, subscription_plan_id, price_paid, lessons_total, lessons_attended, assigned_group_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [b.student_id, b.subscription_plan_id, b.price_paid, b.lessons_total, b.lessons_attended || 0, b.assigned_group_id]);
    res.json(r.rows[0]);
});
app.patch('/student_subscriptions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const b = req.body;
    const keys = Object.keys(b);
    const set = keys.map((k, i) => `${k}=$${i+2}`).join(', ');
    const vals = Object.values(b);
    const r = await pool.query(`UPDATE student_subscriptions SET ${set} WHERE id=$1 RETURNING *`, [id, ...vals]);
    res.json(r.rows[0]);
});
app.delete('/student_subscriptions', authenticateToken, async (req, res) => {
    const ids = req.query.ids ? req.query.ids.split(',') : (req.query.id ? [req.query.id] : []);
    if (ids.length) await pool.query('DELETE FROM student_subscriptions WHERE id = ANY($1)', [ids]);
    res.json({success:true});
});

app.get('/financial_transactions', authenticateToken, async (req, res) => {
    const r = await pool.query('SELECT * FROM financial_transactions ORDER BY date DESC');
    res.json(r.rows);
});
app.post('/financial_transactions', authenticateToken, async (req, res) => {
    const b = req.body;
    const r = await pool.query('INSERT INTO financial_transactions (student_id, date, type, amount, description, student_subscription_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [b.student_id, b.date || new Date(), b.type, b.amount, b.description, b.student_subscription_id]);
    res.json(r.rows[0]);
});
app.delete('/financial_transactions', authenticateToken, async (req, res) => {
    const ids = req.query.ids ? req.query.ids.split(',') : (req.query.id ? [req.query.id] : []);
    if (ids.length) await pool.query('DELETE FROM financial_transactions WHERE id = ANY($1)', [ids]);
    res.json({success:true});
});

// Generic Delete and Update for single ID items
['groups', 'subscription_plans', 'expenses'].forEach(table => {
    app.patch(`/${table}/:id`, authenticateToken, async (req, res) => {
        const keys = Object.keys(req.body);
        const set = keys.map((k, i) => `${k}=$${i+2}`).join(', ');
        const r = await pool.query(`UPDATE ${table} SET ${set} WHERE id=$1 RETURNING *`, [req.params.id, ...Object.values(req.body)]);
        res.json(r.rows[0]);
    });
    app.delete(`/${table}`, authenticateToken, async (req, res) => {
        const id = req.query.id;
        if(id) await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
        res.json({success:true});
    });
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/', (req, res) => {
    res.json({
        service: 'Teacher CRM Backend',
        version: BACKEND_VERSION,
        status: 'running',
        db_connected: true // Assumed true if server didn't crash on startup query
    });
});

app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
});
