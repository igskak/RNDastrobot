"""
Перевірка аспектів з фіктивними точками
"""
from datetime import datetime
from app.database.connection import get_db_session
from app.database.models import NatalAspect, User
from sqlalchemy import or_, and_

def check_fictive_aspects():
    """Перевірити аспекти з фіктивними точками"""
    session = get_db_session()
    
    try:
        # Знайти користувача
        user = session.query(User).filter(
            User.birth_date == datetime.strptime('1990-09-11', '%Y-%m-%d').date(),
            User.birth_time == datetime.strptime('09:39:00', '%H:%M:%S').time()
        ).first()
        
        if not user:
            print("❌ Користувача не знайдено")
            return
        
        print(f"✅ Користувач: {user.user_id}")
        print()
        
        # Фіктивні точки
        fictive_points = ['BlackMoon', 'WhiteMoon', 'TrueNorthNode', 'TrueSouthNode', 'Proserpina']
        
        # Планети для конфігурацій
        planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 
                   'Uranus', 'Neptune', 'Pluto', 'Chiron']
        
        print("="*80)
        print("🔍 АСПЕКТИ З ФІКТИВНИМИ ТОЧКАМИ")
        print("="*80)
        
        for point in fictive_points:
            # Знайти всі аспекти з цією точкою
            aspects = session.query(NatalAspect).filter(
                NatalAspect.user_id == user.user_id,
                or_(
                    NatalAspect.planet_1 == point,
                    NatalAspect.planet_2 == point
                )
            ).all()
            
            print(f"\n📍 {point}: {len(aspects)} аспектів")
            
            if aspects:
                # Групувати по типу аспекту
                by_type = {}
                for asp in aspects:
                    if asp.aspect_type not in by_type:
                        by_type[asp.aspect_type] = []
                    by_type[asp.aspect_type].append(asp)
                
                for asp_type, asps in sorted(by_type.items()):
                    print(f"  {asp_type}: {len(asps)}")
                    for asp in asps[:3]:  # Показати перші 3
                        other = asp.planet_2 if asp.planet_1 == point else asp.planet_1
                        print(f"    • {point} - {other} (орбіс: {asp.orb:.2f}°)")
        
        print("\n" + "="*80)
        print("🔍 АСПЕКТИ МІЖ ФІКТИВНИМИ ТОЧКАМИ")
        print("="*80)
        
        # Аспекти між фіктивними точками
        for i, point1 in enumerate(fictive_points):
            for point2 in fictive_points[i+1:]:
                aspects = session.query(NatalAspect).filter(
                    NatalAspect.user_id == user.user_id,
                    or_(
                        and_(NatalAspect.planet_1 == point1, NatalAspect.planet_2 == point2),
                        and_(NatalAspect.planet_1 == point2, NatalAspect.planet_2 == point1)
                    )
                ).all()
                
                if aspects:
                    print(f"\n{point1} - {point2}: {len(aspects)} аспектів")
                    for asp in aspects:
                        print(f"  • {asp.aspect_type} (орбіс: {asp.orb:.2f}°)")
        
        print("\n" + "="*80)
        print("🔍 ПЕРЕВІРКА КОНКРЕТНИХ КОНФІГУРАЦІЙ")
        print("="*80)
        
        # Перевірити конкретні конфігурації зі списку
        configs_to_check = [
            ('Moon', 'Jupiter', 'BlackMoon', 'TrueSouthNode'),
            ('Moon', 'TrueNorthNode', 'BlackMoon', 'TrueSouthNode'),
            ('Mars', 'Jupiter', 'BlackMoon', 'TrueSouthNode'),
            ('Mars', 'TrueNorthNode', 'BlackMoon', 'TrueSouthNode'),
            ('Mars', 'WhiteMoon', 'BlackMoon', 'TrueSouthNode'),
            ('Moon', 'Venus', 'BlackMoon'),
            ('Mars', 'Venus', 'BlackMoon'),
            ('Venus', 'Proserpina', 'Uranus'),
        ]
        
        for config in configs_to_check:
            print(f"\n🔎 Конфігурація: {' - '.join(config)}")
            
            # Знайти всі аспекти між цими планетами
            all_aspects = []
            for i, p1 in enumerate(config):
                for p2 in config[i+1:]:
                    aspects = session.query(NatalAspect).filter(
                        NatalAspect.user_id == user.user_id,
                        or_(
                            and_(NatalAspect.planet_1 == p1, NatalAspect.planet_2 == p2),
                            and_(NatalAspect.planet_1 == p2, NatalAspect.planet_2 == p1)
                        )
                    ).all()
                    
                    for asp in aspects:
                        all_aspects.append(f"  {p1} - {p2}: {asp.aspect_type} ({asp.orb:.2f}°)")
            
            if all_aspects:
                for asp_str in all_aspects:
                    print(asp_str)
            else:
                print("  ❌ Аспектів не знайдено")
        
    finally:
        session.close()

if __name__ == '__main__':
    check_fictive_aspects()

