-- Очистка старых таблиц (если есть), чтобы создать структуру с нуля
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS schedule_event_exceptions CASCADE;
DROP TABLE IF EXISTS schedule_events CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS financial_transactions CASCADE;
DROP TABLE IF EXISTS student_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Таблица профилей пользователей (учителя/админы)
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- ID приходит от Auth сервиса или генерируется сервером
    email TEXT NOT NULL UNIQUE,
    role TEXT CHECK (role IN ('admin', 'teacher')) DEFAULT 'teacher',
    permissions JSONB DEFAULT '{}'::jsonb
);

-- 2. Таблица групп
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

-- 3. Таблица учеников
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    birth_date DATE,
    parent_name TEXT NOT NULL,
    parent_phone1 TEXT NOT NULL,
    parent_phone2 TEXT,
    parent_email TEXT,
    balance NUMERIC DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active',
    archived_date TIMESTAMP WITH TIME ZONE,
    group_ids TEXT[] DEFAULT '{}' -- Массив ID групп (упрощенная связь)
);

-- 4. Таблица планов подписок (абонементов)
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    lesson_count INTEGER NOT NULL DEFAULT 8,
    is_default BOOLEAN DEFAULT FALSE
);

-- 5. Таблица активных подписок учеников
CREATE TABLE student_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subscription_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    price_paid NUMERIC NOT NULL,
    lessons_total INTEGER NOT NULL,
    lessons_attended INTEGER DEFAULT 0,
    assigned_group_id UUID -- Можно привязать абонемент к конкретной группе
);

-- 6. Финансовые транзакции
CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT CHECK (type IN ('payment', 'refund', 'correction', 'debit')),
    amount NUMERIC NOT NULL,
    description TEXT,
    student_subscription_id UUID REFERENCES student_subscriptions(id) ON DELETE SET NULL
);

-- 7. Посещаемость (Журнал)
CREATE TABLE attendance (
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'excused')),
    grade INTEGER,
    student_subscription_id UUID REFERENCES student_subscriptions(id) ON DELETE SET NULL,
    PRIMARY KEY (student_id, date)
);

-- 8. Расписание (События)
CREATE TABLE schedule_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE
);

-- 9. Исключения для повторяющихся событий (переносы/отмены конкретных занятий)
CREATE TABLE schedule_event_exceptions (
    original_event_id UUID REFERENCES schedule_events(id) ON DELETE CASCADE,
    original_start_time TEXT NOT NULL, -- Ключ конкретного повторения (ISO строка)
    new_title TEXT,
    new_group_id UUID,
    new_start_time TIMESTAMP WITH TIME ZONE,
    new_end_time TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (original_event_id, original_start_time)
);

-- 10. Расходы учителя
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL
);

-- Создадим системный план "По умолчанию" (заглушка)
INSERT INTO subscription_plans (id, name, price, lesson_count, is_default)
VALUES ('00000000-0000-0000-0000-000000000000', 'Разовое занятие', 0, 1, FALSE)
ON CONFLICT (id) DO NOTHING;
