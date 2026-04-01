"""
Тесты для двухрежимного расчёта балансов.
"""
import sys
from pathlib import Path
import unittest


sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.balance_service import BalanceService


class BalanceServiceTest(unittest.TestCase):
    def test_build_dual_balances_splits_sign_and_house_groups(self):
        service = BalanceService(None)

        planets = [
            {'name': 'Sun', 'sign': 'Aries', 'house': 1},
            {'name': 'Moon', 'sign': 'Libra', 'house': 7},
            {'name': 'Mercury', 'sign': 'Gemini', 'house': 10},
        ]
        special_points = [
            {'point': 'BlackMoon', 'sign': 'Cancer', 'house': 4},
        ]

        balances = service.build_dual_balances(planets, special_points)

        by_sign = balances['by_sign']
        self.assertEqual(by_sign['zones_balance'], {'brahma': 4.0, 'vishnu': 2.0, 'shiva': 0.0})
        self.assertEqual(by_sign['quadrant_balance'], {'q1': 3.5, 'q2': 0.5, 'q3': 2.0, 'q4': 0.0})
        self.assertEqual(
            by_sign['hemisphere_balance'],
            {'lower': 4.0, 'upper': 2.0, 'eastern': 3.5, 'western': 2.5},
        )

        by_house = balances['by_house']
        self.assertEqual(by_house['zones_balance'], {'brahma': 2.5, 'vishnu': 2.0, 'shiva': 1.5})
        self.assertEqual(by_house['quadrant_balance'], {'q1': 2.0, 'q2': 0.5, 'q3': 2.0, 'q4': 1.5})
        self.assertEqual(
            by_house['hemisphere_balance'],
            {'lower': 2.5, 'upper': 3.5, 'eastern': 3.5, 'western': 2.5},
        )


if __name__ == '__main__':
    unittest.main()
