"""
Простой скрипт для тестирования API
"""
import requests
import json

# URL API
API_URL = "http://localhost:8000/api/v1/natal/calculate"

# Тестовые данные
test_data = {
    "date": "1990-03-15",
    "time": "14:30:00",
    "timezone": "America/New_York",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "house_system": "P"
}

print("🚀 Тестирование API расчёта натальной карты...")
print(f"📍 Данные: {test_data['date']} {test_data['time']} ({test_data['timezone']})")
print(f"📍 Координаты: {test_data['latitude']}, {test_data['longitude']}")
print()

try:
    response = requests.post(API_URL, json=test_data)
    
    if response.status_code == 200:
        result = response.json()
        
        print("✅ Успешно!")
        print()
        print("=" * 80)
        print("ДАННЫЕ РОЖДЕНИЯ:")
        print("=" * 80)
        birth_data = result['birth_data']
        print(f"Дата: {birth_data['date']}")
        print(f"Время: {birth_data['time']}")
        print(f"Временная зона: {birth_data['timezone']}")
        print(f"UTC время: {birth_data['utc_time']}")
        print(f"Юлианский день: {birth_data['julian_day']}")
        print(f"Координаты: {birth_data['latitude']}, {birth_data['longitude']}")
        
        print()
        print("=" * 80)
        print("ПЛАНЕТЫ:")
        print("=" * 80)
        for planet in result['planets']:
            retro = " ℞" if planet['retrograde'] else ""
            print(f"{planet['name']:12} {planet['longitude']:7.2f}° {planet['sign']:12} "
                  f"(Дом {planet['house']:2}){retro}")
        
        print()
        print("=" * 80)
        print("УГЛЫ:")
        print("=" * 80)
        for angle_name, angle_data in result['angles'].items():
            print(f"{angle_name:12} {angle_data['longitude']:7.2f}° {angle_data['sign']:12}")
        
        print()
        print("=" * 80)
        print("ДОМА:")
        print("=" * 80)
        for house in result['houses']:
            print(f"Дом {house['number']:2}  {house['longitude']:7.2f}° {house['sign']:12}")
        
        print()
        print("=" * 80)
        print("СПЕЦИАЛЬНЫЕ ТОЧКИ:")
        print("=" * 80)
        for point_name, point_data in result['special_points'].items():
            print(f"{point_name:20} {point_data['longitude']:7.2f}° {point_data['sign']:12} "
                  f"(Дом {point_data['house']:2})")
        
        print()
        print("=" * 80)
        print("КОНФИГУРАЦИИ:")
        print("=" * 80)
        if result.get('configurations'):
            for config_name, config_data in result['configurations'].items():
                print(f"\n{config_name}:")
                for point_name, longitude in config_data.items():
                    print(f"  {point_name:15} {longitude:7.2f}°")
        
        print()
        print("=" * 80)
        
        # Сохраним результат в файл
        with open('natal_chart_result.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print("\n💾 Результат сохранён в файл: natal_chart_result.json")
        
    else:
        print(f"❌ Ошибка: {response.status_code}")
        print(response.json())
        
except requests.exceptions.ConnectionError:
    print("❌ Не удалось подключиться к API. Убедитесь, что сервер запущен.")
except Exception as e:
    print(f"❌ Ошибка: {e}")

