"""
Тест API для проверки Прозерпины в натальной карте
"""

import requests
import json


def test_api_proserpina():
    """Тест через HTTP API"""
    
    print("=" * 70)
    print("ТЕСТ API: ПРОЗЕРПИНА В НАТАЛЬНОЙ КАРТЕ")
    print("=" * 70)
    
    # URL API (предполагаем, что сервер запущен на localhost:8000)
    url = "http://localhost:8000/api/v1/natal-chart"
    
    # Данные запроса
    payload = {
        "date": "1990-09-11",
        "time": "10:39:00",
        "timezone": "Europe/Kiev",
        "latitude": 50.0,
        "longitude": 36.25,
        "house_system": "P"
    }
    
    print("Запрос:")
    print(json.dumps(payload, indent=2))
    print()
    
    try:
        # Отправляем запрос
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            
            # Ищем Прозерпину в планетах
            proserpina = None
            for planet in data.get('planets', []):
                if planet['name'] == 'Proserpina':
                    proserpina = planet
                    break
            
            if proserpina:
                print("✓ Прозерпина найдена в ответе!")
                print()
                print("ПРОЗЕРПИНА:")
                print(f"  Долгота: {proserpina['longitude']:.6f}°")
                print(f"  Знак: {proserpina['sign']}")
                print(f"  Позиция в знаке: {proserpina['degree_in_sign_formatted']}")
                print(f"  Дом: {proserpina.get('house', '?')}")
                print(f"  Ретроградная: {proserpina.get('retrograde', False)}")
                print()
                
                # Проверка
                degree_in_sign = proserpina['degree_in_sign']
                degrees = int(degree_in_sign)
                minutes = (degree_in_sign - degrees) * 60
                
                print("ПРОВЕРКА:")
                print(f"  Ожидаем: 2°37' Scorpio")
                print(f"  Получили: {degrees}°{minutes:.0f}' {proserpina['sign']}")
                
                if proserpina['sign'] == 'Scorpio' and degrees == 2 and abs(minutes - 37) < 2:
                    print("  ✓ ТЕСТ ПРОЙДЕН!")
                else:
                    print("  ✗ ТЕСТ НЕ ПРОЙДЕН")
            else:
                print("❌ Прозерпина НЕ найдена в ответе!")
                print()
                print("Доступные планеты:")
                for planet in data.get('planets', []):
                    print(f"  - {planet['name']}")
        else:
            print(f"❌ Ошибка API: {response.status_code}")
            print(response.text)
    
    except requests.exceptions.ConnectionError:
        print("❌ Не удалось подключиться к API")
        print("   Убедитесь, что сервер запущен на http://localhost:8000")
        print()
        print("   Для запуска сервера выполните:")
        print("   python -m uvicorn app.api.main:app --reload")
    
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    print("=" * 70)


if __name__ == "__main__":
    test_api_proserpina()

