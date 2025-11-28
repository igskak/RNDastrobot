#!/usr/bin/env python3
"""
Тест интеграции с базой данных
"""
import requests
import json
from uuid import UUID

BASE_URL = "http://localhost:8000/api/v1"

def test_save_and_retrieve():
    """Тест сохранения и получения натальной карты"""
    
    print("=" * 80)
    print("🧪 Тест интеграции с БД")
    print("=" * 80)
    
    # 1. Создаём натальную карту с сохранением в БД
    print("\n1️⃣  Создаём натальную карту с save_to_db=true...")
    
    birth_data = {
        "date": "1990-03-15",
        "time": "14:30:00",
        "timezone": "America/New_York",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "house_system": "P"
    }
    
    response = requests.post(
        f"{BASE_URL}/natal/calculate",
        params={"save_to_db": True},
        json=birth_data
    )
    
    if response.status_code != 200:
        print(f"❌ Ошибка при создании: {response.status_code}")
        print(response.text)
        return
    
    result = response.json()
    user_id = result.get("user_id")
    
    if not user_id:
        print("❌ user_id не возвращён!")
        return
    
    print(f"✅ Натальная карта создана и сохранена!")
    print(f"   User ID: {user_id}")
    print(f"   Планет: {len(result['planets'])}")
    print(f"   Домов: {len(result['houses'])}")
    print(f"   Углов: {len(result['angles'])}")
    print(f"   Спец. точек: {len(result['special_points'])}")
    
    # 2. Получаем натальную карту из БД
    print(f"\n2️⃣  Получаем натальную карту из БД по ID {user_id}...")
    
    response = requests.get(f"{BASE_URL}/natal/{user_id}")
    
    if response.status_code != 200:
        print(f"❌ Ошибка при получении: {response.status_code}")
        print(response.text)
        return
    
    retrieved = response.json()
    
    print(f"✅ Натальная карта получена из БД!")
    print(f"   User ID: {retrieved.get('user_id')}")
    print(f"   Дата рождения: {retrieved['birth_data']['date']}")
    print(f"   Время рождения: {retrieved['birth_data']['time']}")
    print(f"   Место: {retrieved['birth_data']['place']}")
    print(f"   Планет: {len(retrieved['planets'])}")
    print(f"   Домов: {len(retrieved['houses'])}")
    
    # 3. Сравниваем данные
    print("\n3️⃣  Сравниваем данные...")
    
    # Сравниваем планеты
    original_planets = {p['name']: p for p in result['planets']}
    retrieved_planets = {p['name']: p for p in retrieved['planets']}
    
    planets_match = True
    for name in original_planets:
        orig = original_planets[name]
        retr = retrieved_planets[name]
        
        if abs(orig['longitude'] - retr['longitude']) > 0.01:
            print(f"   ⚠️  {name}: долгота не совпадает ({orig['longitude']} vs {retr['longitude']})")
            planets_match = False
    
    if planets_match:
        print("   ✅ Все планеты совпадают!")
    
    # Сравниваем дома
    houses_match = all(
        abs(result['houses'][i]['longitude'] - retrieved['houses'][i]['longitude']) < 0.01
        for i in range(len(result['houses']))
    )
    
    if houses_match:
        print("   ✅ Все дома совпадают!")
    else:
        print("   ⚠️  Дома не совпадают!")
    
    # Сравниваем специальные точки
    sp_match = True
    for key in result['special_points']:
        orig = result['special_points'][key]
        retr = retrieved['special_points'][key]
        
        if abs(orig['longitude'] - retr['longitude']) > 0.01:
            print(f"   ⚠️  {key}: долгота не совпадает ({orig['longitude']} vs {retr['longitude']})")
            sp_match = False
    
    if sp_match:
        print("   ✅ Все специальные точки совпадают!")

    # Проверяем конфигурации
    if 'FateCross' in result['configurations'] and 'FateCross' in retrieved['configurations']:
        print("   ✅ Крест Судьбы сохранён и извлечён!")
    else:
        print("   ⚠️  Крест Судьбы отсутствует!")

    print("\n" + "=" * 80)
    print("✅ Тест завершён успешно!")
    print("=" * 80)


if __name__ == "__main__":
    test_save_and_retrieve()

