"""
Скрипт валидации натальных карт против эталонных данных ZET
"""
import json
from datetime import datetime
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.natal_chart_service import NatalChartService

# Путь к эфемеридам
EPHE_PATH = str(Path(__file__).parent.parent / 'swisseph' / 'ephe')

def load_reference(path: str) -> dict:
    """Загрузить эталонные данные"""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_timezone(tz_str: str) -> str:
    """Преобразовать timezone из эталона в формат pytz"""
    tz_mapping = {
        '+3:00': 'Etc/GMT-3',
        'GMT+2:00': 'Etc/GMT-2',
    }
    return tz_mapping.get(tz_str, tz_str)

def compare_value(name: str, ref_val, calc_val, tolerance: float = 0.01) -> dict | None:
    """Сравнить значения с допуском"""
    if ref_val is None or calc_val is None:
        if ref_val != calc_val:
            return {'name': name, 'ref': ref_val, 'calc': calc_val, 'diff': 'N/A', 'hypothesis': 'Один из источников не имеет данных'}
        return None
    
    diff = abs(ref_val - calc_val)
    if diff > tolerance:
        return {'name': name, 'ref': round(ref_val, 6), 'calc': round(calc_val, 6), 'diff': round(diff, 6)}
    return None

def validate_chart(ref_path: str, service: NatalChartService) -> dict:
    """Валидировать одну карту"""
    ref = load_reference(ref_path)
    bd = ref['birth_data']
    
    # Парсинг входных данных
    birth_date = datetime.strptime(bd['date'], '%Y-%m-%d').date()
    birth_time = datetime.strptime(bd['time'], '%H:%M:%S').time()
    timezone = parse_timezone(bd['timezone'])
    
    print(f"\n📅 Карта: {bd['date']} {bd['time']} | {bd.get('place', 'N/A')}")
    print(f"   Координаты: {bd['latitude']}°N, {bd['longitude']}°E")
    print(f"   Таймзона: {bd['timezone']} → {timezone}")
    
    # Рассчитываем нашу карту
    calc = service.calculate_natal_chart(
        birth_date=birth_date,
        birth_time=birth_time,
        timezone=timezone,
        latitude=bd['latitude'],
        longitude=bd['longitude'],
        house_system='P'  # Placidus
    )
    
    discrepancies = {'planets': [], 'houses': [], 'angles': [], 'special_points': []}
    
    # 1. Сравнение планет
    ref_planets = {p['name']: p for p in ref['planets']}
    calc_planets = {p['name']: p for p in calc['planets']}
    
    for name, ref_p in ref_planets.items():
        calc_p = calc_planets.get(name)
        if not calc_p:
            discrepancies['planets'].append({'name': name, 'ref': ref_p['longitude'], 'calc': 'MISSING', 'diff': 'N/A'})
            continue
        d = compare_value(f"{name} longitude", ref_p['longitude'], calc_p['longitude'], 0.01)
        if d:
            d['house_ref'] = ref_p.get('house')
            d['house_calc'] = calc_p.get('house')
            discrepancies['planets'].append(d)
    
    # 2. Сравнение домов
    ref_houses = {h['number']: h for h in ref['houses']}
    calc_houses = {h['number']: h for h in calc['houses']}
    
    for num, ref_h in ref_houses.items():
        calc_h = calc_houses.get(num)
        if calc_h:
            d = compare_value(f"House {num}", ref_h['longitude'], calc_h['longitude'], 0.01)
            if d:
                discrepancies['houses'].append(d)
    
    # 3. Сравнение углов
    for angle_name in ['ASC', 'MC', 'IC', 'DSC']:
        ref_a = ref['angles'].get(angle_name)
        calc_a = calc['angles'].get(angle_name)
        if ref_a and calc_a:
            d = compare_value(angle_name, ref_a['longitude'], calc_a['longitude'], 0.01)
            if d:
                discrepancies['angles'].append(d)
    
    # 4. Сравнение специальных точек
    for point_name in ['TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'WhiteMoon', 'Fortune']:
        ref_sp = ref['special_points'].get(point_name)
        calc_sp = calc['special_points'].get(point_name)
        if ref_sp and calc_sp:
            d = compare_value(point_name, ref_sp['longitude'], calc_sp['longitude'], 0.01)
            if d:
                discrepancies['special_points'].append(d)
    
    return {'ref_path': ref_path, 'birth_data': bd, 'discrepancies': discrepancies, 'calc': calc, 'ref': ref}

def print_report(results: list[dict]):
    """Вывести отчёт о расхождениях"""
    print("\n" + "="*80)
    print("📊 ОТЧЁТ О РАСХОЖДЕНИЯХ")
    print("="*80)
    
    for r in results:
        bd = r['birth_data']
        d = r['discrepancies']
        total = sum(len(v) for v in d.values())
        
        print(f"\n📅 Карта: {bd['date']} {bd['time']} ({bd.get('place', 'N/A')})")
        print(f"   Всего расхождений: {total}")
        
        for category, items in d.items():
            if items:
                print(f"\n   🔸 {category.upper()}:")
                for item in items:
                    print(f"      {item['name']}: ZET={item['ref']} | APP={item['calc']} | Δ={item['diff']}")

def main():
    ref_dir = Path(__file__).parent.parent / 'Reference charts'
    refs = [
        ref_dir / 'Эталонная_карта_17.01.1988.json',
        ref_dir / 'Эталонная_карта_26.06.1944.json',
    ]
    
    service = NatalChartService(ephe_path=EPHE_PATH)
    results = []
    
    for ref_path in refs:
        if ref_path.exists():
            results.append(validate_chart(str(ref_path), service))
        else:
            print(f"⚠️ Файл не найден: {ref_path}")
    
    print_report(results)
    return results

if __name__ == '__main__':
    main()

