-- Миграция 015: Добавление имени/фамилии пользователя + очистка старых данных
-- Дата: 2026-02-08

-- 1. Очистка всех существующих пользователей (каскадно удалит все связанные данные)
DELETE FROM users;

-- 2. Добавление полей имени и фамилии
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- 3. Индекс для поиска по имени
CREATE INDEX IF NOT EXISTS idx_users_name ON users (last_name, first_name);

