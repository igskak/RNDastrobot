-- ============================================================================
-- Migration 006: Add co_ruler field to ref_sign_properties
-- ============================================================================
-- Source: Астрокурс_main.txt
-- ============================================================================
-- У некоторых знаков есть два управителя (соуправителя):
-- Virgo: Меркурий + Прозерпина
-- Libra: Венера + Хирон
-- Scorpio: Плутон + Марс
-- Sagittarius: Юпитер + Нептун
-- Capricorn: Сатурн + Уран
-- Aquarius: Уран + Сатурн
-- Pisces: Нептун + Юпитер
-- ============================================================================

-- Добавляем поле co_ruler
ALTER TABLE ref_sign_properties ADD COLUMN IF NOT EXISTS co_ruler VARCHAR(20);

-- Заполняем соуправителей по Астрокурсу
UPDATE ref_sign_properties SET co_ruler = 'Proserpina' WHERE sign = 'Virgo';
UPDATE ref_sign_properties SET co_ruler = 'Chiron' WHERE sign = 'Libra';
UPDATE ref_sign_properties SET co_ruler = 'Mars' WHERE sign = 'Scorpio';
UPDATE ref_sign_properties SET co_ruler = 'Neptune' WHERE sign = 'Sagittarius';
UPDATE ref_sign_properties SET co_ruler = 'Uranus' WHERE sign = 'Capricorn';
UPDATE ref_sign_properties SET co_ruler = 'Saturn' WHERE sign = 'Aquarius';
UPDATE ref_sign_properties SET co_ruler = 'Jupiter' WHERE sign = 'Pisces';

-- Verify
SELECT sign, ruler, co_ruler FROM ref_sign_properties WHERE co_ruler IS NOT NULL ORDER BY sign;

