"""
Перевірка Прозерпіни
"""
from datetime import datetime
from app.database.connection import get_db_session
from app.database.models import NatalPlanet, NatalSpecialPoint, User, RefPlanetOrb

def check_proserpina():
    """Перевірити Прозерпіну"""
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
        
        print(f"✅ Користувач: {user.user_id}\n")
        
        # Перевірити, чи є Proserpina в планетах
        proserpina_planet = session.query(NatalPlanet).filter(
            NatalPlanet.user_id == user.user_id,
            NatalPlanet.planet == 'Proserpina'
        ).first()
        
        if proserpina_planet:
            print(f"✅ Proserpina знайдена в natal_planets:")
            print(f"   Довгота: {proserpina_planet.degree}°")
            print(f"   Знак: {proserpina_planet.sign}")
            print(f"   Будинок: {proserpina_planet.house_number}")
        else:
            print("❌ Proserpina НЕ знайдена в natal_planets")
        
        # Перевірити, чи є Proserpina в спецточках
        proserpina_point = session.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user.user_id,
            NatalSpecialPoint.point == 'Proserpina'
        ).first()
        
        if proserpina_point:
            print(f"\n✅ Proserpina знайдена в natal_special_points:")
            print(f"   Довгота: {proserpina_point.degree}°")
            print(f"   Знак: {proserpina_point.sign}")
            print(f"   Будинок: {proserpina_point.house_number}")
        else:
            print("\n❌ Proserpina НЕ знайдена в natal_special_points")
        
        # Перевірити орбіси для Proserpina
        print("\n" + "="*80)
        print("🔍 ОРБІСИ ДЛЯ PROSERPINA")
        print("="*80)
        
        orbs = session.query(RefPlanetOrb).filter(
            RefPlanetOrb.planet == 'Proserpina'
        ).all()
        
        if orbs:
            print(f"\n✅ Знайдено {len(orbs)} орбісів для Proserpina:")
            for orb in orbs[:5]:  # Показати перші 5
                print(f"   {orb.aspect_type}: {orb.orb}°")
        else:
            print("\n❌ Орбіси для Proserpina НЕ знайдені!")
        
        # Перевірити всі планети/точки користувача
        print("\n" + "="*80)
        print("📋 ВСІ ПЛАНЕТИ/ТОЧКИ КОРИСТУВАЧА")
        print("="*80)
        
        planets = session.query(NatalPlanet).filter(
            NatalPlanet.user_id == user.user_id
        ).all()
        
        print(f"\nПланети ({len(planets)}):")
        for p in planets:
            print(f"  • {p.planet}: {p.degree:.2f}° ({p.sign})")
        
        points = session.query(NatalSpecialPoint).filter(
            NatalSpecialPoint.user_id == user.user_id
        ).all()
        
        print(f"\nСпеціальні точки ({len(points)}):")
        for p in points:
            print(f"  • {p.point}: {p.degree:.2f}° ({p.sign})")
        
    finally:
        session.close()

if __name__ == '__main__':
    check_proserpina()

