-- Migration: 014_add_prognostic_interpretations.sql
-- Description: Кэш AI-интерпретаций прогностических данных
-- Необходим для AI-чатбота: каждый вызов OpenAI стоит денег и занимает секунды

CREATE TABLE IF NOT EXISTS prognostic_interpretations (
    interpretation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Тип прогностики
    method VARCHAR(30) NOT NULL CHECK (
        method IN ('transits', 'progressions', 'directions', 'solar_return')
    ),

    -- Период / дата запроса
    period_start DATE,          -- начало периода (для транзитов)
    period_end DATE,            -- конец периода (для транзитов)
    target_date DATE,           -- конкретная дата (для прогрессий/дирекций)
    year INTEGER,               -- год (для соляра)

    -- Сырые астро-данные, отправленные в AI
    raw_data JSONB,

    -- AI-интерпретация
    interpretation JSONB NOT NULL,
    content_hash VARCHAR(64) NOT NULL,  -- SHA256 для инвалидации кэша

    -- Метаданные AI
    openai_model VARCHAR(50),
    tokens_used INTEGER,
    generation_time_ms INTEGER,

    -- Метаданные
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_pi_user_method
    ON prognostic_interpretations(user_id, method);

CREATE INDEX IF NOT EXISTS idx_pi_content_hash
    ON prognostic_interpretations(content_hash);

CREATE INDEX IF NOT EXISTS idx_pi_created
    ON prognostic_interpretations(created_at);

-- Комментарии
COMMENT ON TABLE prognostic_interpretations IS 'Кэш AI-интерпретаций прогностики (транзиты, прогрессии, дирекции, соляр)';
COMMENT ON COLUMN prognostic_interpretations.method IS 'Метод прогностики: transits, progressions, directions, solar_return';
COMMENT ON COLUMN prognostic_interpretations.content_hash IS 'SHA256 хэш сырых данных для инвалидации кэша при изменении натальной карты';
COMMENT ON COLUMN prognostic_interpretations.raw_data IS 'Сырые астро-данные, отправленные в AI (для воспроизводимости)';

