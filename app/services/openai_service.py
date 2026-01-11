"""
Сервис для работы с OpenAI API

Используется для генерации интерпретаций натальных карт через OpenAI.
Поддерживает кэширование результатов и использование prompt ID из Playground.
"""
import os
import json
import hashlib
from typing import Dict, Any, Optional
from openai import OpenAI
from loguru import logger


class OpenAIService:
    """Сервис для генерации интерпретаций через OpenAI API"""
    
    # Классические планеты для психопрофиля
    CLASSICAL_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
    
    def __init__(self):
        """Инициализация клиента OpenAI"""
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4.1')
        self.prompt_id = os.getenv('OPENAI_PROMPT_ID')
        self.prompt_version = os.getenv('OPENAI_PROMPT_VERSION', '1.0')
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY не найден в переменных окружения")
        
        self.client = OpenAI(api_key=self.api_key)
        logger.info(f"OpenAI сервис инициализирован (модель: {self.model})")
    
    @staticmethod
    def calculate_chart_hash(chart_data: Dict[str, Any]) -> str:
        """
        Вычислить хэш ключевых параметров карты для кэширования

        Args:
            chart_data: Данные натальной карты

        Returns:
            SHA256 хэш в hex формате
        """
        # Берём только данные 7 классических планет
        CLASSICAL_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
        key_data = {
            'planets': [
                {
                    'name': p['name'],
                    'sign': p['sign'],
                    'degree': round(p.get('degree_in_sign', 0), 2),
                    'house': p.get('house'),
                    'retrograde': p.get('retrograde', False),
                    'dignity': p.get('dignity'),
                    'special_roles': sorted(p.get('special_roles', [])),
                    'critical_degrees': sorted(p.get('critical_degrees', [])),
                    'sun_relation': p.get('sun_relation'),
                    'aspect_harmony': p.get('aspect_harmony'),
                    'is_peregrine': p.get('is_peregrine', False),
                    'is_stationary': p.get('is_stationary', False),
                }
                for p in chart_data.get('planets', [])
                if p['name'] in CLASSICAL_PLANETS
            ],
            'aspects': [
                {
                    'p1': a['planet_1'],
                    'p2': a['planet_2'],
                    'type': a['aspect_type'],
                    'orb': round(a['orb'], 1),
                    'is_partile': a.get('is_partile', False),
                }
                for a in chart_data.get('aspects', [])
                if a['planet_1'] in CLASSICAL_PLANETS
                and a['planet_2'] in CLASSICAL_PLANETS
            ]
        }
        
        key_json = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(key_json.encode('utf-8')).hexdigest()
    
    def prepare_psychological_profile_data(self, chart_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Подготовить данные для отправки в OpenAI (только 7 планет)
        
        Args:
            chart_data: Полные данные натальной карты
            
        Returns:
            Очищенные данные для психопрофиля
        """
        planets = [
            {
                'name': p['name'],
                'sign': p['sign'],
                'degree_in_sign': p.get('degree_in_sign'),
                'degree_in_sign_formatted': p.get('degree_in_sign_formatted'),
                'house': p.get('house'),
                'retrograde': p.get('retrograde', False),
                'element': p.get('element'),
                'mode': p.get('mode'),
                'dignity': p.get('dignity'),
                'strength_score': p.get('strength_score'),
                'special_roles': p.get('special_roles', []),
                'critical_degrees': p.get('critical_degrees', []),
                'sun_relation': p.get('sun_relation'),
                'aspect_harmony': p.get('aspect_harmony'),
                'is_peregrine': p.get('is_peregrine', False),
                'is_stationary': p.get('is_stationary', False),
                'stationary_type': p.get('stationary_type'),
                'is_elevated': p.get('is_elevated', False),
                'in_intercepted_sign': p.get('in_intercepted_sign', False),
            }
            for p in chart_data.get('planets', [])
            if p['name'] in self.CLASSICAL_PLANETS
        ]
        
        aspects = [
            {
                'planet_1': a['planet_1'],
                'planet_2': a['planet_2'],
                'aspect_type': a['aspect_type'],
                'orb': a['orb'],
                'is_partile': a.get('is_partile', False),
                'harmonic_type': a.get('harmonic_type'),
            }
            for a in chart_data.get('aspects', [])
            if a['planet_1'] in self.CLASSICAL_PLANETS 
            and a['planet_2'] in self.CLASSICAL_PLANETS
        ]
        
        return {
            'planets': planets,
            'aspects': aspects
        }
    
    async def generate_psychological_profile(
        self,
        chart_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Генерация психологического профиля через OpenAI API
        
        Использует prompt ID из OpenAI Playground.
        
        Args:
            chart_data: Данные натальной карты
            
        Returns:
            Словарь с результатом:
            {
                'content': {...},  # Ответ от OpenAI
                'model': 'gpt-4.1',
                'tokens': 1234,
                'prompt_id': '...'
            }
        """
        profile_data = self.prepare_psychological_profile_data(chart_data)
        data_json = json.dumps(profile_data, ensure_ascii=False, indent=2)
        
        logger.info(f"Отправка запроса в OpenAI (модель: {self.model}, prompt_id: {self.prompt_id})")
        logger.debug(f"Размер данных: {len(data_json)} символов")
        
        try:
            # Используем Responses API для работы с сохранёнными промптами
            response = self.client.responses.create(
                prompt={
                    "id": self.prompt_id,
                    "variables": {
                        "chart_data": data_json
                    }
                }
            )

            # Получаем текст ответа
            content_text = response.output_text
            tokens_used = response.usage.total_tokens if hasattr(response, 'usage') and response.usage else 0

            # Пробуем распарсить JSON из ответа
            try:
                content = json.loads(content_text)
            except json.JSONDecodeError:
                # Если не JSON, возвращаем как текст
                content = {"raw_text": content_text}

            logger.info(f"OpenAI ответ получен ({tokens_used} токенов)")

            return {
                'content': content,
                'model': self.model,
                'tokens': tokens_used,
                'prompt_id': self.prompt_id,
                'prompt_version': self.prompt_version
            }

        except Exception as e:
            logger.error(f"Ошибка OpenAI API: {str(e)}")
            raise


# Singleton instance
_openai_service: Optional[OpenAIService] = None


def get_openai_service() -> OpenAIService:
    """Получить экземпляр OpenAI сервиса (singleton)"""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service

