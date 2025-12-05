#!/usr/bin/env python3
"""
Test script for new aspect configurations
"""

import sys
from pathlib import Path
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from database.connection import get_db_session
from services.configuration_service import ConfigurationService

# Test user ID from the JSON file
TEST_USER_ID = UUID("515561ac-01be-4584-a67a-d42d6b61add2")


def test_configurations():
    """Test configuration detection for the test user"""
    print("="*60)
    print("Testing New Aspect Configurations")
    print("="*60)
    print()
    
    # Get database session
    db = get_db_session()
    
    try:
        # Create configuration service
        config_service = ConfigurationService(db)
        
        # Detect configurations
        print("Detecting configurations...")
        configurations = config_service.detect_configurations(TEST_USER_ID)
        
        print(f"\nFound {len(configurations)} configurations:")
        print()
        
        # Group by type
        by_type = {}
        for config in configurations:
            config_type = config['type']
            if config_type not in by_type:
                by_type[config_type] = []
            by_type[config_type].append(config)
        
        # Display results
        for config_type, configs in sorted(by_type.items()):
            print(f"{config_type}: {len(configs)} found")
            for i, config in enumerate(configs, 1):
                planets = ', '.join(config['planets_involved'])
                apex = f" (apex: {config['apex_planet']})" if 'apex_planet' in config else ""
                strength = config['strength_score']
                print(f"  {i}. {planets}{apex} [strength: {strength}]")
            print()
        
        # Compare with expected configurations from Zet
        print("="*60)
        print("Expected configurations from Zet:")
        print("="*60)
        print()
        
        expected = {
            'Chariot': [
                'Луна, Юпитер, Лилит, Сев. Узел',
                'Луна, Южн. Узел, Лилит, Сев. Узел',
                'Марс, Юпитер, Лилит, Сев. Узел',
                'Марс, Южн. Узел, Лилит, Сев. Узел',
                'Марс, Прозерпина, Лилит, Сев. Узел'
            ],
            'Bisextile': [
                'Солнце, Плутон, Сатурн',
                'Венера, Уран, Хирон'
            ],
            'T_Square': [
                'Луна, Венера, Лилит',
                'Марс, Венера, Лилит'
            ]
        }
        
        for config_type, expected_configs in expected.items():
            print(f"{config_type}: {len(expected_configs)} expected")
            for config in expected_configs:
                print(f"  - {config}")
            print()
        
        print("="*60)
        print("Analysis:")
        print("="*60)
        print()
        
        # Check if we found the expected configurations
        found_types = set(by_type.keys())
        expected_types = set(expected.keys())
        
        missing = expected_types - found_types
        extra = found_types - expected_types
        
        if missing:
            print(f"⚠️  Missing configuration types: {', '.join(missing)}")
        else:
            print("✓ All expected configuration types found!")
        
        if extra:
            print(f"ℹ️  Additional configuration types found: {', '.join(extra)}")
        
        print()
        
    finally:
        db.close()


if __name__ == '__main__':
    test_configurations()

