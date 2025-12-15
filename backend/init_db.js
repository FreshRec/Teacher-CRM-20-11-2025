const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Проверка наличия строки подключения
if (!process.env.DATABASE_URL) {
    console.error('\x1b[31m%s\x1b[0m', 'Ошибка: Не задана переменная окружения DATABASE_URL');
    console.log('Пример использования (в одной строке):');
    console.log('DATABASE_URL="postgres://user:password@host:6432/dbname" node backend/init_db.js');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Yandex Cloud требует SSL. rejectUnauthorized: false позволяет подключиться без явного указания пути к сертификату CA,
    // что безопасно для задач инициализации, так как сервер принудительно использует шифрование.
    ssl: {
        rejectUnauthorized: false 
    }
});

async function initDb() {
    try {
        console.log('Подключение к базе данных...');
        const client = await pool.connect();
        console.log('Подключение успешно.');

        const schemaPath = path.join(__dirname, 'schema.sql');
        console.log(`Чтение файла схемы: ${schemaPath}`);
        
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Выполнение SQL запроса...');
        await client.query(sql);
        
        console.log('\x1b[32m%s\x1b[0m', 'Успешно! База данных инициализирована таблицами.');
        client.release();
    } catch (err) {
        console.error('\x1b[31m%s\x1b[0m', 'Ошибка при выполнении SQL:');
        console.error(err);
    } finally {
        await pool.end();
    }
}

initDb();
